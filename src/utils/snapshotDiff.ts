/**
 * 저장본 비교: 이전(기준) 품목과 현재(비교) 품목을 짝지어 바뀐 내용을 찾는다.
 * 짝짓기: ① 같은 품목 ID → ② 공정·품명·규격·단위·엑셀행 → ③ 공정·품명·규격·단위 (순서대로)
 */
import { SpecItem } from '../types';

export type DiffKind = 'category' | 'section' | 'quantity' | 'amount' | 'added' | 'removed';

export const DIFF_KIND_LABEL: Record<DiffKind, string> = {
  category: '카테고리 변경',
  section: '공정 변경',
  quantity: '수량 변경',
  amount: '금액 변경',
  added: '추가된 품목',
  removed: '빠진 품목',
};

export interface DiffRow {
  kinds: DiffKind[];
  before?: SpecItem;
  after?: SpecItem;
}

export interface SnapshotDiffResult {
  rows: DiffRow[];
  counts: Record<DiffKind, number>;
  unchanged: number;
  /** 카테고리 이동 요약: "이전 → 현재" 별 건수 (많은 순) */
  categoryMoves: { from: string; to: string; count: number }[];
  /** 짝지은 방법 (참고용) */
  matchedById: number;
  matchedByKey: number;
}

const norm = (s?: string) => (s || '').replace(/\s+/g, '').toLowerCase();
const cat = (i?: SpecItem) => ((i?.category || '').trim() || '미분류');
const num = (v: any) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/,/g, '')) || 0);
const close = (a: number, b: number) => Math.abs(a - b) < 0.0005 * Math.max(1, Math.abs(a), Math.abs(b));

const keyFull = (i: SpecItem) => `${norm(i.section)}|${norm(i.name)}|${norm(i.specification)}|${norm(i.unit)}|${i.excelRowIdx ?? ''}`;
const keyLoose = (i: SpecItem) => `${norm(i.section)}|${norm(i.name)}|${norm(i.specification)}|${norm(i.unit)}`;

export function diffSnapshots(beforeItems: SpecItem[], afterItems: SpecItem[]): SnapshotDiffResult {
  const before = (beforeItems || []).filter(i => i.id !== 'manual-safety-item');
  const after = (afterItems || []).filter(i => i.id !== 'manual-safety-item');

  const pairs: [SpecItem, SpecItem][] = [];
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  let matchedById = 0;
  let matchedByKey = 0;

  // ① ID
  const beforeById = new Map<string, number>();
  before.forEach((b, i) => { if (b.id) beforeById.set(b.id, i); });
  after.forEach((a, ai) => {
    const bi = a.id ? beforeById.get(a.id) : undefined;
    if (bi !== undefined && !usedBefore.has(bi)) {
      pairs.push([before[bi], a]);
      usedBefore.add(bi);
      usedAfter.add(ai);
      matchedById++;
    }
  });

  // ②, ③ 내용 기준 (같은 키가 여러 개면 나온 순서대로 짝지음)
  for (const keyFn of [keyFull, keyLoose]) {
    const buckets = new Map<string, number[]>();
    before.forEach((b, bi) => {
      if (usedBefore.has(bi)) return;
      const k = keyFn(b);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(bi);
    });
    after.forEach((a, ai) => {
      if (usedAfter.has(ai)) return;
      const list = buckets.get(keyFn(a));
      if (!list || list.length === 0) return;
      const bi = list.shift()!;
      pairs.push([before[bi], a]);
      usedBefore.add(bi);
      usedAfter.add(ai);
      matchedByKey++;
    });
  }

  const counts: Record<DiffKind, number> = { category: 0, section: 0, quantity: 0, amount: 0, added: 0, removed: 0 };
  const rows: DiffRow[] = [];
  const moves = new Map<string, number>();
  let unchanged = 0;

  pairs.forEach(([b, a]) => {
    const kinds: DiffKind[] = [];
    if (cat(b) !== cat(a)) {
      kinds.push('category');
      const mk = `${cat(b)}\u0000${cat(a)}`;
      moves.set(mk, (moves.get(mk) || 0) + 1);
    }
    if (norm(b.section) !== norm(a.section)) kinds.push('section');
    if (!close(num(b.quantity), num(a.quantity))) kinds.push('quantity');
    if (!close(num(b.amount), num(a.amount))) kinds.push('amount');
    if (kinds.length === 0) { unchanged++; return; }
    kinds.forEach(k => counts[k]++);
    rows.push({ kinds, before: b, after: a });
  });

  before.forEach((b, bi) => {
    if (usedBefore.has(bi)) return;
    counts.removed++;
    rows.push({ kinds: ['removed'], before: b });
  });
  after.forEach((a, ai) => {
    if (usedAfter.has(ai)) return;
    counts.added++;
    rows.push({ kinds: ['added'], after: a });
  });

  // 엑셀 행 순서대로 정렬
  const order = (r: DiffRow) => (r.after?.excelRowIdx ?? r.before?.excelRowIdx ?? 1e9);
  rows.sort((x, y) => order(x) - order(y));

  const categoryMoves = Array.from(moves.entries())
    .map(([k, count]) => { const [from, to] = k.split('\u0000'); return { from, to, count }; })
    .sort((x, y) => y.count - x.count);

  return { rows, counts, unchanged, categoryMoves, matchedById, matchedByKey };
}
