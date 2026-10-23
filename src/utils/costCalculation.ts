import { SpecItem, SeparationMethod } from '../types';
import { formatSectionWithHierarchy } from './sectionHierarchy';

/**
 * 품목의 수량을 안전하게 반환하고, 수량이 0이지만 금액이나 단가가 존재하는 경우 복원/산출합니다.
 */
export function getItemQuantity(item: SpecItem): number {
  if (!item) return 0;
  let q = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : (parseFloat(String(item.quantity || '').replace(/,/g, '')) || 0);
  if (q <= 0) {
    const amt = item.amount || 0;
    const prc = item.unitPrice || 0;
    const mAmt = item.materialAmount || 0;
    const mPrc = item.materialUnitPrice || 0;
    const lAmt = item.laborAmount || 0;
    const lPrc = item.laborUnitPrice || 0;
    if (amt > 0 && prc > 0) {
      q = Math.round((amt / prc) * 1000) / 1000;
    } else if (mAmt > 0 && mPrc > 0) {
      q = Math.round((mAmt / mPrc) * 1000) / 1000;
    } else if (lAmt > 0 && lPrc > 0) {
      q = Math.round((lAmt / lPrc) * 1000) / 1000;
    } else if (amt > 0 || mAmt > 0 || lAmt > 0) {
      const cleanU = (item.unit || '').trim();
      if (cleanU === '식' || cleanU === 'set' || cleanU === 'SET' || cleanU === 'lot' || cleanU === 'LOT' || cleanU === '개소' || cleanU === '조' || prc === amt || prc === 0) {
        q = 1;
      }
    }
  }
  return q;
}

/**
 * 수량 및 단가/금액 정합성을 보정합니다.
 */
export function healItem(item: SpecItem): SpecItem {
  const q = getItemQuantity(item);
  let prc = item.unitPrice;
  let amt = item.amount;
  if ((!prc || prc === 0) && amt && amt > 0 && q > 0) {
    prc = Math.round((amt / q) * 100) / 100;
  }
  if ((!amt || amt === 0) && prc && prc > 0 && q > 0) {
    amt = Math.round(prc * q);
  }
  // 업로드 때 내역서의 실제 공종명으로 정리된 품목(sectionParent 있음)은 다시 정리하지 않음 (기본 공종표로 덮어쓰지 않도록)
  const formattedSection = item.section && item.sectionParent === undefined
    ? formatSectionWithHierarchy(item.section)
    : item.section;
  return {
    ...item,
    quantity: q,
    unitPrice: prc,
    amount: amt,
    section: formattedSection
  };
}

/**
 * 외주비 관련 카테고리인지 판별합니다.
 * 예: '외주', '외주비', '외주비+', '외주비+덕트덕', '외주비+지역난방지', '외주비 열선열', '외주공사', '외주노무' 등
 */
export function isOutsourcingCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('외주비') || clean.includes('외주');
}

/**
 * 간접비 관련 카테고리인지 판별합니다.
 * 예: '간접비', '간접공사비', '간접노무비', '간접경비', '간접' 등
 */
export function isIndirectCostCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('간접비') || clean.includes('간접');
}

/**
 * 지급자재 관련 카테고리인지 판별합니다.
 * 예: '지급자재', '지금자재'(오타 대응), '관급자재', '발주자지급' 등
 */
export function isClientSuppliedCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean.includes('지급자재') || clean.includes('지금자재') || clean.includes('관급자재') || clean.includes('발주처지급');
}

/**
 * 품목이 외주 관련인지 판별합니다 (카테고리 또는 품명 기준).
 */
export function isOutsourcingItem(item: SpecItem): boolean {
  if (isOutsourcingCategory(item.category)) return true;
  const name = item.name || '';
  return name.includes('외주');
}

/**
 * 안전장비류 관련 카테고리인지 판별합니다.
 * 예: '안전장비류', '안전장비', '안전' 등
 */
export function isSafetyEquipmentCategory(category?: string | null): boolean {
  if (!category) return false;
  const clean = category.trim().replace(/\s+/g, '');
  return clean === '안전장비류' || clean === '안전' || clean.includes('안전장비');
}

/**
 * 품목이 안전장비류 관련인지 판별합니다 (카테고리 또는 품명 기준).
 */
export function isSafetyEquipmentItem(item: SpecItem): boolean {
  if (isSafetyEquipmentCategory(item.category)) return true;
  const name = item.name || '';
  return name.includes('안전장비');
}

/**
 * 자재비(재료비) 금액 집계에서 완전히 제외해야 하는 카테고리인지 판별합니다.
 * [방식 2]: 외주비는 재료비를 포함하여 외주 턴키로 일괄 집계하므로 순수 재료비에서 제외
 */
export function isExcludedFromMaterialCost(category?: string | null, method: SeparationMethod = 'method2'): boolean {
  const baseExclude = isIndirectCostCategory(category) || isClientSuppliedCategory(category) || isSafetyEquipmentCategory(category);
  if (method === 'method2') {
    return baseExclude || isOutsourcingCategory(category);
  }
  return baseExclude;
}

/**
 * 개별 품목의 순수 자재비(재료비) 금액을 산출합니다.
 * @param method 'method1'(표준: 외주 재료비 포함), 'method2'(공정분리: 외주 턴키 집계)
 */
export function getItemMaterialCost(item: SpecItem, method: SeparationMethod = 'method2'): number {
  // 1. 간접비, 지급자재, 안전장비류, (방식2인 경우 외주) 카테고리/품목은 일반 재료비에서 전면 제외
  if (isExcludedFromMaterialCost(item.category, method) || isSafetyEquipmentItem(item)) {
    return 0;
  }
  
  if (method === 'method2' && isOutsourcingItem(item)) {
    return 0;
  }

  // 2. 명시된 재료비 금액이 있는 경우
  if (item.materialAmount !== undefined && item.materialAmount !== null && item.materialAmount > 0) {
    return item.materialAmount;
  }

  // 3. 재료비 단가와 수량이 있는 경우
  const q = getItemQuantity(item);
  if (item.materialUnitPrice && item.materialUnitPrice > 0 && q > 0) {
    return Math.round(item.materialUnitPrice * q);
  }

  // 4. 노무비만 있고 재료비가 분리되지 않은 경우 금액 차감
  if (item.laborAmount && item.laborAmount > 0) {
    return Math.max(0, (item.amount || 0) - item.laborAmount);
  }

  return item.amount || 0;
}

/**
 * 개별 품목의 외주비/노무비 금액을 산출합니다.
 */
export function getItemLaborCost(item: SpecItem, method: SeparationMethod = 'method2'): number {
  // 안전장비류는 일반 노무비에서 제외
  if (isSafetyEquipmentItem(item)) {
    return 0;
  }

  // 1. 외주비 항목 (카테고리 또는 품명)
  if (isOutsourcingItem(item)) {
    if (method === 'method2') {
      // 방식 2: 재료비와 노무비를 일괄하여 외주비(턴키)로 집계
      return item.amount || ((item.materialAmount || 0) + (item.laborAmount || 0)) || ((getItemQuantity(item) || 0) * (item.unitPrice || 0)) || 0;
    } else {
      // 방식 1: 표준 분리 - 명시된 노무비만 인정
      return item.laborAmount || 0;
    }
  }

  // 2. 간접비 카테고리: 전체 금액이 간접노무비/경비/간접비로 인정
  if (isIndirectCostCategory(item.category)) {
    return item.amount || (item.materialAmount || 0) + (item.laborAmount || 0) || (getItemQuantity(item) * (item.unitPrice || 0)) || 0;
  }

  // 3. 지급자재: 시공/설치 노무비가 별도 기재된 경우에만 인정
  if (isClientSuppliedCategory(item.category)) {
    return item.laborAmount || 0;
  }

  // 4. 일반 품목의 노무비
  if (item.laborAmount !== undefined && item.laborAmount !== null && item.laborAmount > 0) {
    return item.laborAmount;
  }
  const q = getItemQuantity(item);
  if (item.laborUnitPrice && item.laborUnitPrice > 0 && q > 0) {
    return Math.round(item.laborUnitPrice * q);
  }

  return 0;
}

/**
 * 개별 품목의 총 도급/실행 계약 인정 금액을 산출합니다.
 */
export function getItemContractAmount(item: SpecItem, method: SeparationMethod = 'method2'): number {
  if (isSafetyEquipmentItem(item)) {
    return 0;
  }
  if (isClientSuppliedCategory(item.category)) {
    return getItemLaborCost(item, method); // 지급자재는 자재비 0원, 시공노무비만 인정
  }
  if (isIndirectCostCategory(item.category)) {
    return item.amount || getItemLaborCost(item, method);
  }
  if (isOutsourcingItem(item) && method === 'method2') {
    return getItemLaborCost(item, method); // 방식 2: 외주비 전액 (재료비+노무비 일괄)
  }
  return item.amount || (getItemMaterialCost(item, method) + getItemLaborCost(item, method));
}

export interface CostBreakdown {
  materialCost: number;             // 순수 재료비 합계
  laborCost: number;                // 일반 직접노무비
  outsourcingCost: number;          // 외주비 (방식2인 경우 턴키)
  indirectCost: number;             // 간접비
  clientSuppliedCost: number;       // 지급자재비
  safetyEquipmentCost: number;      // [별도] 안전장비류
  totalContractAmount: number;      // 총 계약 합계 금액 (안전장비류 제외)
  totalLaborAndOutsourcing: number; // 외주 및 시공/노무비 합계
}

/**
 * 프로젝트 전 품목의 종합 원가 구성을 산출합니다.
 * @param method 'method1' (표준 분리), 'method2' (외주 턴키/공정분리 방식)
 */
export function calculateCostBreakdown(items: SpecItem[], method: SeparationMethod = 'method2'): CostBreakdown {
  let materialCost = 0;
  let laborCost = 0;
  let outsourcingCost = 0;
  let indirectCost = 0;
  let clientSuppliedCost = 0;
  let safetyEquipmentCost = 0;

  items.forEach(item => {
    const category = item.category || '';

    // 1. 안전장비류: 총 계약 합계 금액에서 전면 제외하고 별도 집계
    if (isSafetyEquipmentItem(item)) {
      safetyEquipmentCost += (item.amount || (item.materialAmount || 0) + (item.laborAmount || 0));
      return;
    }

    // 2. 지급자재: 발주자 지급이므로 자재비 0원, 시공노무비만 인정
    if (isClientSuppliedCategory(category)) {
      clientSuppliedCost += (item.amount || getItemLaborCost(item, method));
      return;
    }

    // 3. 간접비: 전액 간접비로 집계
    if (isIndirectCostCategory(category)) {
      indirectCost += (item.amount || getItemLaborCost(item, method));
      return;
    }

    // 4. 외주비
    if (isOutsourcingItem(item)) {
      if (method === 'method2') {
        // 방식 2: 외주 재료비와 노무비를 일괄하여 외주비로 집계 (일반 재료비에서 제외)
        const fullOutsourcingAmount = item.amount || ((item.materialAmount || 0) + (item.laborAmount || 0)) || ((getItemQuantity(item) || 0) * (item.unitPrice || 0));
        outsourcingCost += fullOutsourcingAmount;
      } else {
        // 방식 1: 외주 품목도 재료비와 노무비를 분리하여 각각 집계
        materialCost += getItemMaterialCost(item, method);
        laborCost += getItemLaborCost(item, method);
      }
      return;
    }

    // 5. 일반 품목의 재료비 및 노무비
    materialCost += getItemMaterialCost(item, method);
    laborCost += getItemLaborCost(item, method);
  });

  const totalContractAmount = materialCost + laborCost + outsourcingCost + indirectCost + clientSuppliedCost;
  const totalLaborAndOutsourcing = laborCost + outsourcingCost + indirectCost;

  return {
    materialCost,
    laborCost,
    outsourcingCost,
    indirectCost,
    clientSuppliedCost,
    safetyEquipmentCost,
    totalContractAmount,
    totalLaborAndOutsourcing
  };
}
