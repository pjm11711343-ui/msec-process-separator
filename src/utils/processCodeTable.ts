/**
 * 현장 공종표 (현장명 · 대공종 · 중공종 · 소공종 · 세부단위)
 * - 공정코드는 현장마다 다르므로, 공정분리 전에 현장별로 공종표를 등록해 두고
 *   내역서 업로드/재적용 시 이 표의 코드·이름으로 공정을 정리한다.
 */
import * as XLSX from 'xlsx';
import { ProcessCodeEntry, SpecItem } from '../types';
import { buildSectionDisplayInfo, combineParentProcessNames, extractProcessCode } from './sectionHierarchy';

export const PROCESS_LEVELS: Record<number, string> = {
  2: '현장명',
  4: '대공종',
  6: '중공종',
  8: '소공종',
  10: '세부단위',
};

export function levelLabel(code: string): string {
  return PROCESS_LEVELS[code.length] || '기타';
}

/** "코드  공종명" 한 줄 해석 (공백/탭 구분, 코드와 이름이 붙어 있어도 인식) */
export function parseProcessCodeLine(line: string): ProcessCodeEntry | null {
  const text = (line || '').replace(/ /g, ' ').trim();
  if (!text) return null;
  // 코드와 평형이 붙은 경우: 010104010159㎡단위세대 → 0101040101 / 59㎡단위세대
  const area = text.match(/^(\d{10})(\d{1,3})\s*((?:㎡|m²|m2|평|형|타입).*)$/i);
  if (area) return { code: area[1], name: `${area[2]}${area[3]}`.trim() };
  const m = text.match(/^(\d{2}|\d{4}|\d{6}|\d{8}|\d{10})(?:[\s\t.:_-]+|(?=\D))(.+)$/);
  if (!m) return null;
  const name = m[2].trim();
  if (!name || /^[\d.,\s-]+$/.test(name)) return null;
  return { code: m[1], name };
}

/** 2자리(현장명)는 실제 하위 코드가 있을 때만 인정, 중복 코드는 앞의 것 유지 */
function cleanEntries(entries: ProcessCodeEntry[]): ProcessCodeEntry[] {
  const seen = new Set<string>();
  const out: ProcessCodeEntry[] = [];
  entries.forEach(e => {
    if (seen.has(e.code)) return;
    seen.add(e.code);
    out.push({ code: e.code, name: e.name.trim() });
  });
  return out.filter(e => e.code.length !== 2 || out.some(o => o.code.length > 2 && o.code.startsWith(e.code)));
}

export function parseProcessCodeText(text: string): ProcessCodeEntry[] {
  const entries = (text || '').split(/\r?\n/).map(parseProcessCodeLine).filter((e): e is ProcessCodeEntry => !!e);
  return cleanEntries(entries);
}

/**
 * 엑셀 파일에서 공종표 추출 (집계표/공종별 집계 시트 우선)
 * - 한 칸에 "010101  장비설치공사" 형태, 또는 코드 칸 + 바로 옆 이름 칸 형태 모두 인식
 */
export function extractProcessCodesFromWorkbook(wb: XLSX.WorkBook, skipSheet?: string): ProcessCodeEntry[] {
  const sheetNames = [...wb.SheetNames]
    .filter(sn => sn !== skipSheet)
    .sort((a, b) => Number(/집계|공종/.test(b)) - Number(/집계|공종/.test(a)));
  for (const sn of sheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }) as any[][];
    const found: ProcessCodeEntry[] = [];
    rows.forEach(r => {
      const cells = (r || []).map(c => String(c ?? '').trim());
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell) continue;
        if (/^(\d{2}|\d{4}|\d{6}|\d{8}|\d{10})$/.test(cell)) {
          const next = cells.slice(i + 1, i + 3).find(v => v && !/^[\d.,\s-]+$/.test(v));
          if (next) { found.push({ code: cell, name: next }); break; }
          continue;
        }
        const e = /^\d{2,12}\s/.test(cell) ? parseProcessCodeLine(cell) : null;
        if (e) { found.push(e); break; }
      }
    });
    const cleaned = cleanEntries(found);
    // 대·중공종(4/6자리)이 함께 있어야 공종표로 인정
    if (cleaned.filter(e => e.code.length === 6).length >= 2) return cleaned;
  }
  return [];
}

export function formatProcessCodeText(entries: ProcessCodeEntry[]): string {
  return entries.map(e => `${e.code}  ${e.name}`).join('\n');
}

/**
 * 등록된 공종표를 이미 올라온 내역 품목에 적용 (다시 업로드하지 않아도 공정명·상위경로를 공종표대로 정리)
 */
export function applyProcessCodeTable(items: SpecItem[], entries: ProcessCodeEntry[]): { items: SpecItem[]; changed: number } {
  if (!entries || entries.length === 0 || !items || items.length === 0) return { items, changed: 0 };
  const names = new Map(entries.map(e => [e.code, e.name]));
  const byName = new Map<string, string>();
  entries.forEach(e => {
    const key = `${e.code.length}|${e.name.replace(/\s+/g, '')}`;
    if (!byName.has(key)) byName.set(key, e.code);
  });
  const current = buildSectionDisplayInfo(items);

  const existingPiece = (pieces: string[], code: string) => pieces.find(p => p.startsWith(`${code} `)) || '';
  const labelFor = (code: string, pieces: string[]): string => {
    if (names.has(code)) return `${code}  ${names.get(code)}`;
    const ex = existingPiece(pieces, code);
    if (ex) return ex;
    return code.length >= 6 ? code : '';
  };
  const chainFor = (code: string, pieces: string[]): string[] =>
    [4, 6, 8].filter(len => len < code.length).map(len => labelFor(code.slice(0, len), pieces)).filter(Boolean);

  let changed = 0;
  const next = items.map(item => {
    const info = current.get(item.id);
    const pieces = info ? info.parents : [];
    const section = item.section || '기본 내역';
    const parsed = extractProcessCode(section);
    let newSection = section;
    let parents: string[];

    if (parsed && [6, 8, 10].includes(parsed.code.length)) {
      let code = parsed.code;
      // 공종표에 없는 코드인데 같은 이름이 다른 코드로 있으면 공종표 코드로 보정
      if (!names.has(code)) {
        const titleName = (info?.title || section).replace(/^\d+\s*/, '');
        const fixed = byName.get(`${code.length}|${titleName.replace(/\s+/g, '')}`);
        if (fixed) code = fixed;
      }
      parents = chainFor(code, pieces);
      if (names.has(code)) {
        const own = names.get(code)!;
        if (code.length === 10) {
          const n6 = names.get(code.slice(0, 6)) || '';
          const n8 = names.get(code.slice(0, 8)) || '';
          const combined = n6 && n8 ? combineParentProcessNames(n6, n8) : '';
          newSection = combined ? `${code}  ${combined} ${own}` : `${code}  ${own}`;
        } else {
          newSection = `${code}  ${own}`;
        }
      }
    } else {
      // 코드 없는 하위공정: 현재 상위경로의 가장 깊은 코드 기준으로 공종표 경로 재구성
      const deepest = [...pieces].reverse().map(p => p.match(/^(\d{6,10})\s/)?.[1]).find(Boolean);
      parents = deepest ? [...chainFor(deepest, pieces), labelFor(deepest, pieces)].filter(Boolean) : pieces.filter(p => !/^\d{4}\s/.test(p));
      if (deepest && item.id === 'manual-safety-item') parents = [];
    }

    // 맨 앞에 4자리 대공종
    const first = [newSection, ...parents].map(p => p.match(/^(\d{6,10})\s/)?.[1]).find(Boolean);
    if (first && names.has(first.slice(0, 4)) && !parents.some(p => p.startsWith(first.slice(0, 4) + ' '))) {
      parents = [`${first.slice(0, 4)}  ${names.get(first.slice(0, 4))}`, ...parents];
    }

    const newParent = parents.join(' › ');
    if (newSection === item.section && newParent === item.sectionParent) return item;
    changed++;
    return { ...item, section: newSection, sectionParent: newParent };
  });
  return { items: next, changed };
}
