/**
 * Utility for hierarchical construction code and section formatting.
 * 
 * Supports standard Korean construction estimate hierarchy:
 * Level 1 (6 digits): 대/중공종 (예: 010104 세대내배관공사)
 * Level 2 (8 digits): 소공종 (예: 01010401 난방배관공사)
 * Level 3 (10 digits): 세부공종/세대타입 (예: 0101040101 세대내 난방 배관공사 59㎡ 단위세대)
 * 
 * Standard Output Format for 내역분리:
 * - 0101040101  세대내 난방 배관공사 59㎡ 단위세대
 * - 0101040102  세대내 난방 배관공사 76㎡ 단위세대
 * - 0101040103  세대내 난방 배관공사 84㎡ 단위세대
 * - 0101040104  세대내 난방 배관공사 95㎡ 단위세대
 * (동일한 규칙이 위생배관공사, 환기공사, 기계실 등 모든 공정에 일관되게 적용됨)
 */

import { SpecItem } from '../types';

// Standard Level 1 (6-digit) Work Process Mappings
export const LEVEL_1_PROCESS_NAMES: Record<string, string> = {
  '010101': '가설공사',
  '010102': '옥외배관공사',
  '010103': '주차장배관공사',
  '010104': '세대내배관공사',
  '010105': '기계실배관공사',
  '010106': '환기덕트공사',
  '010107': '소방배관공사',
  '010108': '보온공사',
  '010109': '자동제어공사',
  '010110': '위생기구설치공사',
};

// Standard Level 2 (8-digit) Work Process Mappings and Combined Display Names
export const LEVEL_2_PROCESS_NAMES: Record<string, { name: string; combined: string }> = {
  // 세대내 배관공사 (010104)
  '01010401': { name: '난방배관공사', combined: '세대내 난방 배관공사' },
  '01010402': { name: '위생배관공사', combined: '세대내 위생 배관공사' },
  '01010403': { name: '환기공사', combined: '세대내 환기 공사' },
  '01010404': { name: '가스배관공사', combined: '세대내 가스 배관공사' },
  '01010405': { name: '소방배관공사', combined: '세대내 소방 배관공사' },
  '01010406': { name: '보온공사', combined: '세대내 보온공사' },
  '01010407': { name: '단위세대 잡자재', combined: '세대내 잡철물공사' },
  '01010408': { name: '급수급탕배관공사', combined: '세대내 급수급탕 배관공사' },
  '01010409': { name: '오배수배관공사', combined: '세대내 오배수 배관공사' },
  
  // 기계실 배관공사 (010105)
  '01010501': { name: '난방배관공사', combined: '기계실 난방 배관공사' },
  '01010502': { name: '위생배관공사', combined: '기계실 위생 배관공사' },
  '01010503': { name: '소방배관공사', combined: '기계실 소방 배관공사' },
  '01010504': { name: '냉각수배관공사', combined: '기계실 냉각수 배관공사' },
  '01010505': { name: '오배수배관공사', combined: '기계실 오배수 배관공사' },
  '01010506': { name: '급수급탕배관공사', combined: '기계실 급수급탕 배관공사' },
  '01010507': { name: '환기덕트공사', combined: '기계실 환기덕트공사' },
  '01010508': { name: '보온공사', combined: '기계실 보온공사' },
  '01010509': { name: '장비설치공사', combined: '기계실 장비설치공사' },

  // 주차장 배관공사 (010103)
  '01010301': { name: '오배수배관공사', combined: '주차장 오배수 배관공사' },
  '01010302': { name: '소방배관공사', combined: '주차장 소방 배관공사' },
  '01010303': { name: '급수급탕배관공사', combined: '주차장 급수급탕 배관공사' },
  '01010304': { name: '환기덕트공사', combined: '주차장 환기덕트공사' },
  '01010305': { name: '제연덕트공사', combined: '주차장 제연덕트공사' },
  '01010306': { name: '보온공사', combined: '주차장 보온공사' },

  // 옥외 배관공사 (010102)
  '01010201': { name: '급수급탕배관공사', combined: '옥외 급수급탕 배관공사' },
  '01010202': { name: '소방배관공사', combined: '옥외 소방 배관공사' },
  '01010203': { name: '오배수배관공사', combined: '옥외 오배수 배관공사' },
  '01010204': { name: '가스배관공사', combined: '옥외 가스 배관공사' },
  '01010205': { name: '우수배관공사', combined: '옥외 우수배관공사' },

  // 환기덕트공사 (010106)
  '01010601': { name: '세대환기덕트', combined: '세대 환기덕트공사' },
  '01010602': { name: '공용부환기덕트', combined: '공용부 환기덕트공사' },
  '01010603': { name: '제연덕트공사', combined: '제연덕트공사' },

  // 소방배관공사 (010107)
  '01010701': { name: '옥내소화전공사', combined: '옥내소화전 배관공사' },
  '01010702': { name: '스프링클러공사', combined: '스프링클러 배관공사' },
  '01010703': { name: '연결송수관공사', combined: '연결송수관 배관공사' },

  // 보온공사 (010108)
  '01010801': { name: '난방배관보온', combined: '난방배관 보온공사' },
  '01010802': { name: '급수급탕보온', combined: '급수급탕 보온공사' },
  '01010803': { name: '오배수배관보온', combined: '오배수배관 보온공사' },
  '01010804': { name: '관보온', combined: '관보온 공사' },
  '01010805': { name: '덕트보온', combined: '덕트보온 공사' },

  // 위생기구설치공사 (010110)
  '01011001': { name: '위생도기류설치', combined: '위생도기류 설치공사' },
  '01011002': { name: '수전금구류설치', combined: '수전금구류 설치공사' },
};

/**
 * Dynamically synthesizes a clean, standard combined parent process name
 * from parent (L1) and sub-process (L2) names.
 * Example: '세대내배관공사' + '난방배관공사' -> '세대내 난방 배관공사'
 */
export function combineParentProcessNames(l1Name: string, l2Name: string): string {
  if (!l1Name && !l2Name) return '';
  if (!l1Name) return l2Name;
  if (!l2Name) return l1Name;

  // Normalize inputs
  const cleanL1 = l1Name.replace(/^\d+[\s._-]*/, '').trim();
  const cleanL2 = l2Name.replace(/^\d+[\s._-]*/, '').trim();

  // If L2 already includes L1 prefix
  if (cleanL2.includes(cleanL1)) {
    return cleanL2;
  }

  // Extract base prefix from L1 (e.g. 세대내배관공사 -> 세대내, 기계실배관공사 -> 기계실)
  let prefix = cleanL1
    .replace(/(배관공사|공사|설비공사)$/g, '')
    .trim();
  if (!prefix) prefix = cleanL1;

  // Format L2 name cleanly (e.g. 난방배관공사 -> 난방 배관공사)
  let sub = cleanL2;
  if (sub.endsWith('배관공사') && !sub.includes(' 배관공사')) {
    sub = sub.replace(/배관공사$/, ' 배관공사');
  } else if (sub.endsWith('공사') && !sub.includes(' 공사') && sub.length > 3) {
    sub = sub.replace(/공사$/, ' 공사');
  }

  return `${prefix} ${sub}`.trim();
}

/**
 * Strips duplicate combined parent names, L2 names, or trade names from the remaining text
 * so that we avoid awkward duplication like "세대내 난방 배관공사 세대내 난방 배관공사 59㎡".
 */
export function stripParentFromRest(rest: string, combinedParent: string, l2Name?: string, l1Name?: string): string {
  let clean = (rest || '').trim();
  if (!clean) return '';

  const candidates: string[] = [];
  if (combinedParent) {
    candidates.push(combinedParent);
    candidates.push(combinedParent.replace(/\s+/g, ''));
  }
  if (l2Name) {
    candidates.push(l2Name);
    candidates.push(l2Name.replace(/\s+/g, ''));
  }
  if (l1Name) {
    candidates.push(l1Name);
    candidates.push(l1Name.replace(/\s+/g, ''));
  }

  // Common process prefixes to remove from rest
  const standardPrefixes = [
    '세대내 난방 배관공사',
    '세대내난방배관공사',
    '난방 배관공사',
    '난방배관공사',
    '세대내 위생 배관공사',
    '세대내위생배관공사',
    '위생 배관공사',
    '위생배관공사',
    '기계실 난방 배관공사',
    '기계실난방배관공사',
    '기계실 위생 배관공사',
    '기계실위생배관공사',
    '주차장 오배수 배관공사',
    '주차장오배수배관공사',
    '옥외 급수급탕 배관공사',
    '옥외급수급탕배관공사',
    '세대내 환기 공사',
    '세대내환기공사',
    '환기 공사',
    '환기공사',
    '세대내 가스 배관공사',
    '세대내가스배관공사',
    '가스 배관공사',
    '가스배관공사',
    '세대내 소방 배관공사',
    '세대내소방배관공사',
    '소방 배관공사',
    '소방배관공사'
  ];

  candidates.push(...standardPrefixes);

  // Filter and sort by length descending so longer matching phrases are stripped first
  const uniquePhrases = Array.from(new Set(candidates.filter(p => Boolean(p && p.length >= 2))))
    .sort((a, b) => b.length - a.length);

  for (const phrase of uniquePhrases) {
    if (clean.includes(phrase)) {
      clean = clean.replace(phrase, '').trim();
    }
  }

  // Also strip leading dashes, dots, colon, >
  clean = clean.replace(/^[\s>_:.-]+/, '').trim();
  return clean;
}

/**
 * Extracts the 10-digit, 8-digit, or 6-digit code from a section string.
 * Supports raw strings, nested paths, dotted/hyphenated/bracketed codes.
 */
export function extractProcessCode(text: string): { code: string; rest: string } | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Clean formatted codes like 01.01.04.01.02 -> 0101040102 or [0101040101] -> 0101040101
  const cleaned = trimmed
    .replace(/^\[?(\d{2})[.-](\d{2})[.-](\d{2})[.-](\d{2})[.-](\d{2})\]?/, '$1$2$3$4$5')
    .replace(/^[\[(](\d{6,10})[\])]\s*/, '$1 ')
    // 코드와 평형이 붙어버린 경우 분리: "010104010159  ㎡단위세대" → "0101040101  59㎡단위세대"
    .replace(/^(\d{10})(\d{1,3})\s*(㎡|m²|m2|평|형|타입)/i, '$1  $2$3');

  // 1. If text contains a 10-digit code anywhere (e.g. 0101040101)
  const match10 = cleaned.match(/(?:^|[\[(\s>_-])(\d{10})(?:[\])\s._-]+(.*))?$/);
  if (match10) {
    return {
      code: match10[1],
      rest: (match10[2] || '').trim()
    };
  }

  // 2. If text contains an 8-digit code anywhere (e.g. 01010401)
  const match8 = cleaned.match(/(?:^|[\[(\s>_-])(\d{8})(?:[\])\s._-]+(.*))?$/);
  if (match8) {
    return {
      code: match8[1],
      rest: (match8[2] || '').trim()
    };
  }

  // 3. Fallback: match 6 to 12 digit code starting at the beginning
  const match = cleaned.match(/^(\d{6,12})[\s._-]*(.*)$/);
  if (match) {
    return {
      code: match[1],
      rest: match[2].trim()
    };
  }

  return null;
}

/**
 * Formats a section string according to the user specification:
 * ALL 10-digit codes consistently display the full combined parent process name:
 * - 0101040101  세대내 난방 배관공사 59㎡ 단위세대
 * - 0101040102  세대내 난방 배관공사 76㎡ 단위세대
 * - 0101040103  세대내 난방 배관공사 84㎡ 단위세대
 * - 0101040104  세대내 난방 배관공사 95㎡ 단위세대
 * 
 * Works for both newly uploaded data and existing project items across all trades.
 */
export function formatSectionWithHierarchy(
  sectionStr: string,
  dynamicContext?: {
    l1Map?: Record<string, string>;
    l2Map?: Record<string, { name: string; combined: string }>;
  }
): string {
  if (!sectionStr) return '기본 내역';
  const trimmed = sectionStr.trim();

  const parsed = extractProcessCode(trimmed);
  if (!parsed) {
    return trimmed;
  }

  const { code, rest } = parsed;

  // We are specifically handling 10-digit detailed process/unit codes
  if (code.length === 10) {
    const l2Code = code.slice(0, 8);
    const l1Code = code.slice(0, 6);

    // Look up combined parent name
    let combinedParent = '';
    const l2Info = dynamicContext?.l2Map?.[l2Code] || LEVEL_2_PROCESS_NAMES[l2Code];
    if (l2Info) {
      combinedParent = l2Info.combined;
    } else {
      const l1Name = dynamicContext?.l1Map?.[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '';
      const l2Name = dynamicContext?.l2Map?.[l2Code]?.name || '';
      if (l1Name || l2Name) {
        combinedParent = combineParentProcessNames(l1Name, l2Name);
      }
    }

    // Default fallbacks for standard codes if not mapped
    if (!combinedParent) {
      if (l2Code === '01010401') combinedParent = '세대내 난방 배관공사';
      else if (l2Code === '01010402') combinedParent = '세대내 위생 배관공사';
      else if (l2Code === '01010403') combinedParent = '세대내 환기 공사';
      else if (l2Code === '01010404') combinedParent = '세대내 가스 배관공사';
      else if (l2Code === '01010405') combinedParent = '세대내 소방 배관공사';
      else if (l2Code === '01010406') combinedParent = '세대내 보온공사';
      else if (l2Code === '01010501') combinedParent = '기계실 난방 배관공사';
      else if (l2Code === '01010502') combinedParent = '기계실 위생 배관공사';
      else if (l2Code === '01010301') combinedParent = '주차장 오배수 배관공사';
      else if (l2Code === '01010201') combinedParent = '옥외 급수급탕 배관공사';
    }

    // Clean rest from any already embedded combinedParent to avoid duplicate stacking
    const l1Name = dynamicContext?.l1Map?.[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code];
    const cleanRest = stripParentFromRest(rest, combinedParent, l2Info?.name, l1Name);

    // All items (01, 02, 03, 04, etc.) include the combined parent process name
    if (combinedParent) {
      return `${code}  ${combinedParent}${cleanRest ? ` ${cleanRest}` : ''}`;
    } else {
      return `${code}  ${cleanRest}`;
    }
  }

  // 8-digit sub-process header formatting: e.g. 01010401  난방배관공사
  if (code.length === 8) {
    return `${code}  ${rest}`;
  }

  // 6-digit main-process header formatting: e.g. 010104  세대내배관공사
  if (code.length === 6) {
    return `${code}  ${rest}`;
  }

  return trimmed;
}

/**
 * Stateful tracker used during Excel row parsing to maintain the hierarchical context
 * (Level 1, Level 2, Level 3) and generate properly combined section titles.
 */
export class HierarchicalSectionTracker {
  private currentL1Code = '';
  private currentL1Name = '';
  private currentL2Code = '';
  private currentL2Name = '';
  private currentCombinedParent = '';

  // 상위 공정 경로 추적 (화면/엑셀의 "대공종 › 소공종" 표시용)
  private codedPath: string[] = [];
  private lastParents: string[] = [];

  private dynamicL1Map: Record<string, string> = { ...LEVEL_1_PROCESS_NAMES };

  /** 직전 handleHeaderRow 로 정해진 공정의 상위 경로 */
  public getLastParents(): string[] {
    return [...this.lastParents];
  }

  private l1Label(l1Code: string): string {
    const name = this.currentL1Code === l1Code && this.currentL1Name
      ? this.currentL1Name
      : (this.dynamicL1Map[l1Code] || '');
    return name ? `${l1Code}  ${name}` : l1Code;
  }

  private l2Label(l2Code: string): string {
    const name = this.currentL2Code === l2Code && this.currentL2Name
      ? this.currentL2Name
      : (this.dynamicL2Map[l2Code]?.name || '');
    return name ? `${l2Code}  ${name}` : l2Code;
  }
  private dynamicL2Map: Record<string, { name: string; combined: string }> = { ...LEVEL_2_PROCESS_NAMES };

  /**
   * Process a potential header row from Excel.
   * Returns the normalized section name to assign to items, or null if it's not a section header.
   */
  public handleHeaderRow(rawText: string): string {
    const text = (rawText || '').trim();
    if (!text) {
      this.lastParents = [];
      return '기본 내역';
    }

    const parsed = extractProcessCode(text);
    if (!parsed) {
      // 코드 없는 하위 공정 ("1. 시스템자재", "(연간단가)수전류" 등) → 직전 코드 공정 아래에 소속
      this.lastParents = [...this.codedPath];
      return text;
    }

    const { code, rest } = parsed;

    if (code.length === 6) {
      // Level 1 Header (e.g. 010104 세대내배관공사)
      this.currentL1Code = code;
      this.currentL1Name = rest;
      this.dynamicL1Map[code] = rest;
      this.currentL2Code = '';
      this.currentL2Name = '';
      this.currentCombinedParent = '';
      this.lastParents = [];
      this.codedPath = [`${code}  ${rest}`];
      return `${code}  ${rest}`;
    }

    if (code.length === 8) {
      // Level 2 Header (e.g. 01010401 난방배관공사)
      this.currentL2Code = code;
      this.currentL2Name = rest;

      // Ensure Level 1 is set
      const l1Code = code.slice(0, 6);
      if (!this.currentL1Code || this.currentL1Code !== l1Code) {
        this.currentL1Code = l1Code;
        this.currentL1Name = this.dynamicL1Map[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '';
      }

      this.currentCombinedParent = combineParentProcessNames(this.currentL1Name, rest);
      this.dynamicL2Map[code] = {
        name: rest,
        combined: this.currentCombinedParent
      };

      this.lastParents = [this.l1Label(l1Code)];
      this.codedPath = [...this.lastParents, `${code}  ${rest}`];
      return `${code}  ${rest}`;
    }

    if (code.length === 10) {
      // Level 3 Header (e.g. 0101040101 59㎡ 단위세대, 0101040102 76㎡ 단위세대)
      const l2Code = code.slice(0, 8);
      const l1Code = code.slice(0, 6);

      if (!this.currentL2Code || this.currentL2Code !== l2Code) {
        this.currentL2Code = l2Code;
        const l2Info = this.dynamicL2Map[l2Code] || LEVEL_2_PROCESS_NAMES[l2Code];
        if (l2Info) {
          this.currentL2Name = l2Info.name;
          this.currentCombinedParent = l2Info.combined;
        } else {
          this.currentL1Code = l1Code;
          this.currentL1Name = this.dynamicL1Map[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '';
          this.currentCombinedParent = combineParentProcessNames(this.currentL1Name, '');
        }
      }

      // Default fallbacks for standard codes if not mapped
      if (!this.currentCombinedParent) {
        if (l2Code === '01010401') this.currentCombinedParent = '세대내 난방 배관공사';
        else if (l2Code === '01010402') this.currentCombinedParent = '세대내 위생 배관공사';
        else if (l2Code === '01010403') this.currentCombinedParent = '세대내 환기 공사';
        else if (l2Code === '01010404') this.currentCombinedParent = '세대내 가스 배관공사';
        else if (l2Code === '01010405') this.currentCombinedParent = '세대내 소방 배관공사';
        else if (l2Code === '01010406') this.currentCombinedParent = '세대내 보온공사';
        else if (l2Code === '01010501') this.currentCombinedParent = '기계실 난방 배관공사';
        else if (l2Code === '01010502') this.currentCombinedParent = '기계실 위생 배관공사';
        else if (l2Code === '01010301') this.currentCombinedParent = '주차장 오배수 배관공사';
        else if (l2Code === '01010201') this.currentCombinedParent = '옥외 급수급탕 배관공사';
      }

      // Clean rest from any already present parent name
      const cleanRest = stripParentFromRest(rest, this.currentCombinedParent, this.currentL2Name, this.currentL1Name);

      if (this.currentL1Code !== l1Code) {
        this.currentL1Code = l1Code;
        this.currentL1Name = this.dynamicL1Map[l1Code] || '';
      }
      this.lastParents = [this.l1Label(l1Code), this.l2Label(l2Code)];
      this.codedPath = [...this.lastParents, `${code}  ${cleanRest || rest}`];

      // Consistently return with the combined parent process name
      if (this.currentCombinedParent) {
        return `${code}  ${this.currentCombinedParent}${cleanRest ? ` ${cleanRest}` : ''}`;
      }
      return `${code}  ${cleanRest}`;
    }

    this.lastParents = [];
    this.codedPath = [`${code}  ${rest}`];
    return `${code}  ${rest}`;
  }

  public getDynamicContext() {
    return {
      l1Map: this.dynamicL1Map,
      l2Map: this.dynamicL2Map
    };
  }
}

/**
 * Normalizes all SpecItem sections in a project to adhere to the hierarchical pattern:
 * - 0101040101  세대내 난방 배관공사 59㎡ 단위세대
 * - 0101040102  세대내 난방 배관공사 76㎡ 단위세대
 * - 0101040103  세대내 난방 배관공사 84㎡ 단위세대
 * - 0101040104  세대내 난방 배관공사 95㎡ 단위세대
 * (and all other work processes like 위생, 환기, 기계실, etc.)
 */
export function normalizeAllItemsSections(items: SpecItem[]): { items: SpecItem[]; updatedCount: number } {
  if (!items || items.length === 0) {
    return { items: [], updatedCount: 0 };
  }

  // Pass 1: Build dynamic dictionary of codes from existing sections if any
  const l1Map: Record<string, string> = { ...LEVEL_1_PROCESS_NAMES };
  const l2Map: Record<string, { name: string; combined: string }> = { ...LEVEL_2_PROCESS_NAMES };

  items.forEach(item => {
    if (!item.section) return;
    const parsed = extractProcessCode(item.section);
    if (!parsed) return;
    const { code, rest } = parsed;
    if (code.length === 6 && rest) {
      l1Map[code] = rest;
    } else if (code.length === 8 && rest) {
      const l1Code = code.slice(0, 6);
      const l1Name = l1Map[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '';
      l2Map[code] = {
        name: rest,
        combined: combineParentProcessNames(l1Name, rest)
      };
    }
  });

  // Pass 2: Format all item sections
  let updatedCount = 0;
  const updatedItems = items.map(item => {
    const originalSection = item.section || '기본 내역';
    const formatted = formatSectionWithHierarchy(originalSection, { l1Map, l2Map });

    if (formatted !== originalSection) {
      updatedCount += 1;
      return {
        ...item,
        section: formatted
      };
    }
    return item;
  });

  return { items: updatedItems, updatedCount };
}

export interface SectionHierarchyAncestors {
  l1Code: string;
  l1Name: string;
  l1Full: string;
  l2Code: string;
  l2Name: string;
  l2Full: string;
  l3Code: string;
  l3CleanName: string;
  l3Full: string;
  combinedParent: string;
  breadcrumb: string;
}

/**
 * Extracts complete ancestor hierarchy (Level 1 main process and Level 2 sub process)
 * from any section string for displaying breadcrumbs or inserting repeated header rows.
 */
export function getSectionHierarchyAncestors(
  sectionStr: string,
  dynamicContext?: {
    l1Map?: Record<string, string>;
    l2Map?: Record<string, { name: string; combined: string }>;
  }
): SectionHierarchyAncestors | null {
  if (!sectionStr) return null;
  const parsed = extractProcessCode(sectionStr);
  if (!parsed) return null;

  const { code, rest } = parsed;

  if (code.length === 10) {
    const l1Code = code.slice(0, 6);
    const l2Code = code.slice(0, 8);
    const l3Code = code;

    const l1Name = dynamicContext?.l1Map?.[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '세대내배관공사';
    const l2Info = dynamicContext?.l2Map?.[l2Code] || LEVEL_2_PROCESS_NAMES[l2Code];
    let l2Name = l2Info?.name || '';
    let combinedParent = l2Info?.combined || '';

    if (!l2Name) {
      if (l2Code === '01010401') { l2Name = '난방배관공사'; combinedParent = '세대내 난방 배관공사'; }
      else if (l2Code === '01010402') { l2Name = '위생배관공사'; combinedParent = '세대내 위생 배관공사'; }
      else if (l2Code === '01010403') { l2Name = '환기공사'; combinedParent = '세대내 환기 공사'; }
      else if (l2Code === '01010404') { l2Name = '가스배관공사'; combinedParent = '세대내 가스 배관공사'; }
      else if (l2Code === '01010405') { l2Name = '소방배관공사'; combinedParent = '세대내 소방 배관공사'; }
      else if (l2Code === '01010406') { l2Name = '보온공사'; combinedParent = '세대내 보온공사'; }
      else if (l2Code === '01010501') { l2Name = '난방배관공사'; combinedParent = '기계실 난방 배관공사'; }
      else if (l2Code === '01010502') { l2Name = '위생배관공사'; combinedParent = '기계실 위생 배관공사'; }
      else if (l2Code === '01010301') { l2Name = '오배수배관공사'; combinedParent = '주차장 오배수 배관공사'; }
      else if (l2Code === '01010201') { l2Name = '급수급탕배관공사'; combinedParent = '옥외 급수급탕 배관공사'; }
      else {
        l2Name = '세부배관공사';
        combinedParent = combineParentProcessNames(l1Name, l2Name);
      }
    }

    const cleanRest = stripParentFromRest(rest, combinedParent, l2Name, l1Name);
    const l1Full = `${l1Code}  ${l1Name}`;
    const l2Full = `${l2Code}  ${l2Name}`;
    const l3Full = `${l3Code}  ${cleanRest || rest}`;
    const breadcrumb = `${l1Code} ${l1Name}  ›  ${l2Code} ${l2Name}`;

    return {
      l1Code,
      l1Name,
      l1Full,
      l2Code,
      l2Name,
      l2Full,
      l3Code,
      l3CleanName: cleanRest || rest,
      l3Full,
      combinedParent,
      breadcrumb
    };
  }

  if (code.length === 8) {
    const l1Code = code.slice(0, 6);
    const l2Code = code;
    const l1Name = dynamicContext?.l1Map?.[l1Code] || LEVEL_1_PROCESS_NAMES[l1Code] || '';
    const l2Info = dynamicContext?.l2Map?.[l2Code] || LEVEL_2_PROCESS_NAMES[l2Code];
    const l2Name = l2Info?.name || rest;
    const combinedParent = l2Info?.combined || combineParentProcessNames(l1Name, l2Name);

    return {
      l1Code,
      l1Name,
      l1Full: l1Name ? `${l1Code}  ${l1Name}` : l1Code,
      l2Code,
      l2Name,
      l2Full: `${l2Code}  ${l2Name}`,
      l3Code: '',
      l3CleanName: '',
      l3Full: '',
      combinedParent,
      breadcrumb: l1Name ? `${l1Code} ${l1Name}` : ''
    };
  }

  return null;
}

export interface SectionDisplayInfo {
  /** 상위 공정 경로 (예: ["010104  세대내배관공사", "01010401  난방배관공사"]) */
  parents: string[];
  /** 공정 제목 (예: "0101040101  59㎡ 단위세대") */
  title: string;
  /** 같은 공정명이라도 상위 공정이 다르면 다른 그룹이 되도록 하는 키 */
  key: string;
}

/**
 * 모든 품목의 "상위 공정 경로 + 공정 제목"을 계산합니다. (key: item.id)
 * - 업로드 때 기록된 sectionParent 가 있으면 그대로 사용 (내역서의 실제 대공종/소공종 명칭)
 * - 예전 데이터는 코드(6/8/10자리)와 품목 순서로 추정: 코드 없는 하위 공정("1. 시스템자재" 등)은 바로 앞 코드 공정 아래로 소속
 */
export function buildSectionDisplayInfo(items: SpecItem[]): Map<string, SectionDisplayInfo> {
  const result = new Map<string, SectionDisplayInfo>();
  if (!items || items.length === 0) return result;

  // 1. 이 현장 데이터에 실제로 있는 대/소공종 명칭 수집
  const l1Names: Record<string, string> = {};
  const l2Names: Record<string, string> = {};
  const collect = (text: string) => {
    const parsed = extractProcessCode(text);
    if (!parsed || !parsed.rest) return;
    if (parsed.code.length === 6) l1Names[parsed.code] = parsed.rest;
    else if (parsed.code.length === 8) l2Names[parsed.code] = parsed.rest;
  };
  items.forEach(item => {
    if (item.section) collect(item.section);
    if (item.sectionParent) item.sectionParent.split(' › ').forEach(collect);
  });

  const l1Name = (c: string) => l1Names[c] || LEVEL_1_PROCESS_NAMES[c] || '';
  const l2Name = (c: string) => l2Names[c] || LEVEL_2_PROCESS_NAMES[c]?.name || '';
  const label = (c: string, name: string) => (name ? `${c}  ${name}` : c);

  // 2. 품목 순서대로 경로 계산
  let codedPath: string[] = [];
  items.forEach(item => {
    const section = item.section || '기본 내역';
    const parsed = extractProcessCode(section);
    let parents: string[];

    if (typeof item.sectionParent === 'string') {
      parents = item.sectionParent ? item.sectionParent.split(' › ').map(p => p.trim()).filter(Boolean) : [];
    } else if (parsed && parsed.code.length === 6) {
      parents = [];
    } else if (parsed && parsed.code.length === 8) {
      const c1 = parsed.code.slice(0, 6);
      parents = [label(c1, l1Name(c1))];
    } else if (parsed && parsed.code.length === 10) {
      const c1 = parsed.code.slice(0, 6);
      const c2 = parsed.code.slice(0, 8);
      parents = [label(c1, l1Name(c1)), label(c2, l2Name(c2))];
    } else if (item.id === 'manual-safety-item') {
      parents = [];
    } else {
      parents = [...codedPath];
    }

    let title = section;
    if (parsed && parsed.code.length === 10) {
      const c1 = parsed.code.slice(0, 6);
      const c2 = parsed.code.slice(0, 8);
      const n1 = l1Name(c1);
      const n2 = l2Name(c2);
      // 업로드 때 붙은 "세대내 난방 배관공사" 같은 상위 공정명은 제목에서 제거 (상위 경로에 이미 표시되므로)
      const dynamicCombined = combineParentProcessNames(n1, n2);
      const staticCombined = LEVEL_2_PROCESS_NAMES[c2]?.combined || '';
      let cleanRest = stripParentFromRest(parsed.rest, dynamicCombined, n2, n1);
      if (staticCombined) cleanRest = stripParentFromRest(cleanRest, staticCombined);
      title = `${parsed.code}  ${cleanRest || parsed.rest}`.trim();
    }

    if (parsed) codedPath = [...parents, title];

    result.set(item.id, { parents, title, key: `${parents.join(' › ')} § ${section}` });
  });

  return result;
}
