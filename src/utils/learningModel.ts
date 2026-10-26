/**
 * 현장 단위 분류 학습 (지능형 자동 규칙 학습)
 * - 공정분리를 마친 현장의 "품명·규격·공정 → 카테고리"를 현장별로 학습해 두고
 * - 다른 현장을 분류할 때 학습된 모든 현장의 다수결로 카테고리를 추천한다.
 * - 품명/규격은 띄어쓰기·대소문자·곱하기 기호(x,×,*) 차이를 무시하고 비교한다.
 * - 같은 품명이라도 공정(난방/위생/소방…)에 따라 다르게 분류되는 경우를 구분한다.
 */
import { SpecItem } from '../types';
import { builtInClassify } from './classifier';

export type Votes = Record<string, number>;
export type VoteTable = Record<string, Votes>;

export interface SiteLearning {
  projectId: string;
  projectName: string;
  learnedAt: number;
  itemCount: number;   // 학습에 쓰인 품목 수
  keyCount: number;    // 학습 키 수
  votes: VoteTable;
}

export interface LearnedPrediction {
  category: string;
  level: '품명+규격+공정' | '품명+규격' | '품명+공정' | '품명';
  confidence: number; // 0~1
  support: number;    // 학습된 현장 수 (해당 키에 투표한 현장 수)
}

const EXCLUDED_CATEGORIES = new Set(['', '미분류', '기타']);

export function normalizeText(s?: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\s ]+/g, '')
    .replace(/[×＊*]/g, 'x')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[，]/g, ',')
    .replace(/ø|φ|Φ/g, 'd');
}

// 공정 유형: 같은 품명이 공정에 따라 다르게 분류되는 경우를 구분하기 위한 키워드 (앞에서부터 우선)
const PROCESS_KEYWORDS = [
  '난방', '위생', '급수', '급탕', '오배수', '배수', '우수', '소화', '소방', '스프링클러',
  '환기', '덕트', '전열', '가스', '냉매', '보온', '열선', '찬넬', '기계실', '옥외', '주차장', '장비'
];

export function processTypeOf(item: Pick<SpecItem, 'section' | 'sectionParent'>): string {
  const path = `${item.sectionParent || ''} ${item.section || ''}`.replace(/\s+/g, '');
  return PROCESS_KEYWORDS.find(k => path.includes(k)) || '기타';
}

function keysFor(item: SpecItem): { nsp: string; ns: string; np: string; n: string } | null {
  const n = normalizeText(item.name);
  if (!n) return null;
  const s = normalizeText(item.specification);
  const p = processTypeOf(item);
  return {
    nsp: `nsp|${n}|${s}|${p}`,
    ns: `ns|${n}|${s}`,
    np: `np|${n}|${p}`,
    n: `n|${n}`
  };
}

/** 한 현장의 품목들로 학습표 생성 (기본 규칙으로 정해지는 품목·미분류는 제외) */
export function learnFromItems(items: SpecItem[]): { votes: VoteTable; itemCount: number } {
  const votes: VoteTable = {};
  let itemCount = 0;
  items.forEach(item => {
    const cat = (item.category || '').trim();
    if (EXCLUDED_CATEGORIES.has(cat)) return;
    if (item.id === 'manual-safety-item') return;
    // 설계변경·공정기준 외주·지급자재·간접비·스리브는 품목이 아니라 조건으로 정해지므로 학습하지 않음
    if (builtInClassify(item)) return;
    const k = keysFor(item);
    if (!k) return;
    itemCount++;
    Object.values(k).forEach(key => {
      if (!votes[key]) votes[key] = {};
      votes[key][cat] = (votes[key][cat] || 0) + 1;
    });
  });
  return { votes, itemCount };
}

/**
 * 여러 현장 학습표 합치기 — 한 현장은 키마다 1표(그 현장에서 가장 많이 쓴 카테고리)만 행사
 * (품목이 많은 한 현장이 결과를 좌우하지 않도록)
 */
export interface AggregatedModel {
  table: Record<string, { votes: Votes; sites: number }>;
  siteCount: number;
}

export function aggregateLearning(sites: SiteLearning[]): AggregatedModel {
  const table: AggregatedModel['table'] = {};
  sites.forEach(site => {
    Object.entries(site.votes || {}).forEach(([key, v]) => {
      const top = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
      if (!top) return;
      if (!table[key]) table[key] = { votes: {}, sites: 0 };
      table[key].votes[top[0]] = (table[key].votes[top[0]] || 0) + 1;
      table[key].sites += 1;
    });
  });
  return { table, siteCount: sites.length };
}

const LEVELS: { key: 'nsp' | 'ns' | 'np' | 'n'; level: LearnedPrediction['level']; minConf: number }[] = [
  { key: 'nsp', level: '품명+규격+공정', minConf: 0.5 },
  { key: 'ns', level: '품명+규격', minConf: 0.6 },
  { key: 'np', level: '품명+공정', minConf: 0.6 },
  { key: 'n', level: '품명', minConf: 0.66 },
];

/** 학습된 현장들 기준 카테고리 추천 (가까운 키부터, 일치율이 기준 이상일 때만) */
export function predictCategory(item: SpecItem, model: AggregatedModel | null): LearnedPrediction | null {
  if (!model || model.siteCount === 0) return null;
  const k = keysFor(item);
  if (!k) return null;
  for (const lv of LEVELS) {
    const entry = model.table[k[lv.key]];
    if (!entry) continue;
    const total = Object.values(entry.votes).reduce((a, b) => a + b, 0);
    const [cat, cnt] = Object.entries(entry.votes).sort((a, b) => b[1] - a[1])[0];
    const confidence = total > 0 ? cnt / total : 0;
    if (confidence >= lv.minConf) {
      return { category: cat, level: lv.level, confidence, support: entry.sites };
    }
  }
  return null;
}

export function describePrediction(p: LearnedPrediction): string {
  return `학습 분류: ${p.level} 일치 · ${p.support}개 현장 · 일치율 ${Math.round(p.confidence * 100)}%`;
}
