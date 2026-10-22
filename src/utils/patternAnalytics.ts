import { CustomClassificationRule, PatternPerformanceStat, SpecItem } from '../types';

export type { PatternPerformanceStat };

/**
 * Calculates real-time matching accuracy, success/failure counts, and rates
 * for all custom classification rules against the current project items.
 */
export function calculatePatternStats(
  rules: CustomClassificationRule[],
  items: SpecItem[]
): {
  patternStats: PatternPerformanceStat[];
  overall: {
    totalEvaluations: number;
    totalSuccess: number;
    totalFailure: number;
    overallSuccessRate: number;
    overallFailureRate: number;
    activeRuleCount: number;
    topPerformingPattern: string | null;
    needsAttentionPattern: string | null;
    lowPerformanceCount: number;
    lowPerformanceRuleIds: string[];
  };
} {
  if (!rules || rules.length === 0) {
    return {
      patternStats: [],
      overall: {
        totalEvaluations: 0,
        totalSuccess: 0,
        totalFailure: 0,
        overallSuccessRate: 100,
        overallFailureRate: 0,
        activeRuleCount: 0,
        topPerformingPattern: null,
        needsAttentionPattern: null,
        lowPerformanceCount: 0,
        lowPerformanceRuleIds: [],
      },
    };
  }

  // Pre-normalize items for fast text scanning
  const normalizedItems = (items || []).map(item => ({
    id: item.id,
    name: item.name || '',
    specification: item.specification || '',
    category: item.category || '',
    normalizedText: ((item.name || '') + ' ' + (item.specification || '')).toLowerCase().replace(/\s+/g, '')
  }));

  const patternStats: PatternPerformanceStat[] = rules.map(rule => {
    const cleanPattern = (rule.pattern || '').trim().toLowerCase().replace(/\s+/g, '');
    let sheetMatches = 0;
    let sheetSuccess = 0;
    let sheetFailure = 0;
    const mismatchedItems: PatternPerformanceStat['mismatchedItems'] = [];

    if (cleanPattern.length > 0) {
      for (const item of normalizedItems) {
        if (item.normalizedText.includes(cleanPattern)) {
          sheetMatches++;
          if (item.category === rule.category) {
            sheetSuccess++;
          } else if (item.category && item.category !== '미분류') {
            sheetFailure++;
            if (mismatchedItems.length < 10) {
              mismatchedItems.push({
                id: item.id,
                name: item.name,
                specification: item.specification,
                currentCategory: item.category,
                expectedCategory: rule.category,
              });
            }
          }
        }
      }
    }

    const histSuccess = rule.successCount || 0;
    const histFailure = rule.failureCount || 0;

    const totalSuccess = sheetSuccess + histSuccess;
    const totalFailure = sheetFailure + histFailure;
    const totalEvaluations = totalSuccess + totalFailure;

    const successRate = totalEvaluations > 0 
      ? Number(((totalSuccess / totalEvaluations) * 100).toFixed(1)) 
      : 100;
    const failureRate = totalEvaluations > 0 
      ? Number(((totalFailure / totalEvaluations) * 100).toFixed(1)) 
      : 0;

    return {
      id: rule.id,
      pattern: rule.pattern,
      category: rule.category,
      isEnabled: rule.isEnabled,
      priority: rule.priority ?? 10,
      description: rule.description,
      sheetMatches,
      sheetSuccess,
      sheetFailure,
      histSuccess,
      histFailure,
      totalEvaluations,
      totalSuccess,
      totalFailure,
      successRate,
      failureRate,
      mismatchedItems,
    };
  });

  // Calculate overall metrics
  const totalSuccess = patternStats.reduce((sum, p) => sum + p.totalSuccess, 0);
  const totalFailure = patternStats.reduce((sum, p) => sum + p.totalFailure, 0);
  const totalEvaluations = totalSuccess + totalFailure;
  const overallSuccessRate = totalEvaluations > 0 
    ? Number(((totalSuccess / totalEvaluations) * 100).toFixed(1)) 
    : 100;
  const overallFailureRate = totalEvaluations > 0 
    ? Number(((totalFailure / totalEvaluations) * 100).toFixed(1)) 
    : 0;

  // Find top performer and pattern needing attention
  const evaluatedPatterns = patternStats.filter(p => p.totalEvaluations > 0);
  
  let topPerformingPattern: string | null = null;
  let needsAttentionPattern: string | null = null;

  if (evaluatedPatterns.length > 0) {
    const sortedBySuccess = [...evaluatedPatterns].sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      return b.totalSuccess - a.totalSuccess;
    });
    topPerformingPattern = `${sortedBySuccess[0].pattern} (${sortedBySuccess[0].successRate}%)`;

    const sortedByFailure = [...evaluatedPatterns].sort((a, b) => {
      if (b.failureRate !== a.failureRate) return b.failureRate - a.failureRate;
      return b.totalFailure - a.totalFailure;
    });
    if (sortedByFailure[0].failureRate > 0) {
      needsAttentionPattern = `${sortedByFailure[0].pattern} (실패율 ${sortedByFailure[0].failureRate}%)`;
    }
  }

  // Identify patterns with success rate <= 50% that have been evaluated
  const lowPerformanceRules = patternStats.filter(p => p.totalEvaluations > 0 && p.successRate <= 50);
  const lowPerformanceCount = lowPerformanceRules.length;
  const lowPerformanceRuleIds = lowPerformanceRules.map(p => p.id);

  return {
    patternStats,
    overall: {
      totalEvaluations,
      totalSuccess,
      totalFailure,
      overallSuccessRate,
      overallFailureRate,
      activeRuleCount: rules.filter(r => r.isEnabled).length,
      topPerformingPattern,
      needsAttentionPattern,
      lowPerformanceCount,
      lowPerformanceRuleIds,
    },
  };
}

/**
 * Checks if a given pattern performance statistic indicates low performance (<= 50% success rate with at least 1 evaluation)
 */
export function isLowSuccessRule(stat?: PatternPerformanceStat | null): boolean {
  if (!stat) return false;
  return stat.totalEvaluations > 0 && stat.successRate <= 50;
}

/**
 * Updates rule success/failure counters when items are classified or overridden.
 */
export function recordRuleExecutionFeedback(
  rules: CustomClassificationRule[],
  entries: Array<{
    name: string;
    specification?: string;
    finalCategory: string;
    isCorrectiveOverride?: boolean;
  }>
): { updatedRules: CustomClassificationRule[]; changed: boolean } {
  if (!rules || rules.length === 0 || !entries || entries.length === 0) {
    return { updatedRules: rules, changed: false };
  }

  let changed = false;
  const newRules = rules.map(rule => ({ ...rule }));
  const now = Date.now();

  entries.forEach(entry => {
    const cleanPattern = (entry.name + ' ' + (entry.specification || '')).toLowerCase().replace(/\s+/g, '');
    const finalCat = (entry.finalCategory || '').trim();
    if (!cleanPattern || !finalCat) return;

    newRules.forEach(rule => {
      const rulePattern = (rule.pattern || '').trim().toLowerCase().replace(/\s+/g, '');
      if (rulePattern.length > 0 && cleanPattern.includes(rulePattern)) {
        if (rule.category === finalCat) {
          rule.successCount = (rule.successCount || 0) + 1;
          rule.lastEvaluatedAt = now;
          changed = true;
        } else if (entry.isCorrectiveOverride) {
          // If the item had this pattern but user explicitly classified it into another category
          rule.failureCount = (rule.failureCount || 0) + 1;
          rule.lastEvaluatedAt = now;
          changed = true;
        }
      }
    });
  });

  return { updatedRules: newRules, changed };
}
