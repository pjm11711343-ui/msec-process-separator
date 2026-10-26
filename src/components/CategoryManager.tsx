import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, Tags, Sliders, Info, HelpCircle, ChevronUp, ChevronDown, Sparkles, RotateCcw, FileText, Upload, BarChart3, PieChart, Target, Activity, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { CustomClassificationRule, INITIAL_CATEGORIES, SpecItem } from '../types';
import PatternAccuracyChart from './PatternAccuracyChart';
import { calculatePatternStats, isLowSuccessRule, PatternPerformanceStat } from '../utils/patternAnalytics';
import * as XLSX from 'xlsx';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  isOutsourcingCategory, 
  isClientSuppliedCategory, 
  isIndirectCostCategory 
} from '../utils/costCalculation';

interface Props {
  categories: string[];
  categoryColors?: Record<string, string>;
  items: SpecItem[];
  onUpdate: (categories: string[]) => void;
  onUpdateColors?: (colors: Record<string, string>) => void;
  onClose: () => void;
  customRules: CustomClassificationRule[];
  onUpdateRules: (rules: CustomClassificationRule[]) => void;
  onApplyRules?: (rules: CustomClassificationRule[]) => void;
  initialTab?: 'categories' | 'rules' | 'patternStats' | 'stats';
  autoRuleCreation?: boolean;
  onSetAutoRuleCreation?: (val: boolean) => void;
  onRenameCategory?: (oldCategory: string, newCategory: string) => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#71717a'
];

// Read-only system rules for reference inside the UI
const SYSTEM_MAPPING_RULES: Record<string, string> = {
  '고강도 PVC관': '고강도PVC',
  '폴리부틸렌관': 'PB',
  '일반용경질염화비닐관': 'PVC',
  '배배관용스테인리스강관': 'STS위생관',
  '형강/찬넬/인서트': 'SUPPORT류',
  '세대감압밸브': '감압변',
  '온수분배기/구동기': '난방분배기',
  '온수기/제습기': '마감자재',
  '배관인식표/TAG': '명판',
  '게이트/볼/버터플라이 밸브': '밸브류',
  '관보온/밸브보온': '보온재',
  '잡재료비/용접봉': '소모잡자재',
  '수도/온수계량기': '수도계량기',
  '방수/강관스리브': '스리브',
  '동파방지전열선': '열선',
  '시스템찬넬/시스템가대': '조립식가대',
  '3구 분기관/브라켓': '통합거치대',
  '스프링클러 헤드': '소방부속',
  '소방용 CPVC': 'CPVC 소방관',
};

export default function CategoryManager({ 
  categories, 
  categoryColors = {},
  items = [],
  onUpdate, 
  onUpdateColors,
  onClose,
  customRules = [],
  onUpdateRules,
  onApplyRules,
  initialTab = 'categories',
  autoRuleCreation = true,
  onSetAutoRuleCreation,
  onRenameCategory
}: Props) {
  const [activeTab, setActiveTab] = useState<'categories' | 'rules' | 'patternStats' | 'stats'>(initialTab);
  
  // Category management states
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showColorPickerFor, setShowColorPickerFor] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Rules management states
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategory, setRuleCategory] = useState(categories[0] || '');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleSearch, setRuleSearch] = useState('');
  const [rulePriority, setRulePriority] = useState<number>(10);
  const [showSystemRules, setShowSystemRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [filterOnlyLowSuccess, setFilterOnlyLowSuccess] = useState(false);

  // Compute Pattern Performance Stats to identify rules needing attention (success rate <= 50%)
  const statsResult = useMemo(() => {
    return calculatePatternStats(customRules, items);
  }, [customRules, items]);

  const statsMap = useMemo(() => {
    const map = new Map<string, PatternPerformanceStat>();
    statsResult.patternStats.forEach(s => map.set(s.id, s));
    return map;
  }, [statsResult]);

  const lowSuccessRules = useMemo(() => {
    return statsResult.patternStats.filter(s => isLowSuccessRule(s));
  }, [statsResult]);

  // Quick helper to jump from pattern stats to rule editing
  const handleSelectRuleForEdit = (ruleId: string) => {
    const target = customRules.find(r => r.id === ruleId);
    if (target) {
      setEditingRuleId(target.id);
      setRulePattern(target.pattern);
      setRuleCategory(target.category);
      setRulePriority(target.priority ?? 10);
      setRuleDesc(target.description || '');
      setActiveTab('rules');
    }
  };

  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setRulePattern('');
    setRuleCategory(categories[0] || '');
    setRulePriority(10);
    setRuleDesc('');
  };

  // Helper to reset a single rule's historical performance counters
  const handleResetRuleStats = (ruleId: string) => {
    const updated = customRules.map(r => 
      r.id === ruleId ? { ...r, successCount: 0, failureCount: 0, lastEvaluatedAt: Date.now() } : r
    );
    onUpdateRules(updated);
  };

  // Sync tab state when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Set default rule category once categories load
  useEffect(() => {
    if (categories.length > 0 && !ruleCategory) {
      setRuleCategory(categories[0]);
    }
  }, [categories, ruleCategory]);

  // Category Handlers
  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onUpdate([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Extract first column values (assuming categories are listed vertically)
        const importedCategories = jsonData
          .map(row => row[0])
          .filter(val => typeof val === 'string' && val.trim().length > 0)
          .map(val => val.trim());

        if (importedCategories.length === 0) {
          alert('엑셀 파일에서 유효한 카테고리명을 찾을 수 없습니다. 첫 번째 열에 카테고리 이름을 나열해 주세요.');
          return;
        }

        // Merge and deduplicate
        const uniqueNewOnes = importedCategories.filter(cat => !categories.includes(cat));
        if (uniqueNewOnes.length === 0) {
          alert('이미 모든 카테고리가 등록되어 있습니다.');
          return;
        }

        const merged = [...categories, ...uniqueNewOnes];
        onUpdate(merged);
        alert(`${uniqueNewOnes.length}개의 새로운 카테고리가 등록되었습니다.`);
      } catch (error) {
        console.error('Excel parse error:', error);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleResetDefaultCategories = () => {
    if (window.confirm('기본 카테고리 목록(31개)으로 초기화하시겠습니까? 현재 추가된 사용자 지정 카테고리가 기본 목록으로 대체됩니다.')) {
      onUpdate(INITIAL_CATEGORIES);
    }
  };

  const handleDeleteCategory = (index: number) => {
    const deletedCat = categories[index];
    const newList = categories.filter((_, i) => i !== index);
    onUpdate(newList);
    
    // Also warn if custom rules refer to this deleted category
    const anyRuleRefState = customRules.some(r => r.category === deletedCat);
    if (anyRuleRefState) {
      // Auto-assign rule category of affected rules to the first available category
      const firstAvailable = newList[0] || '';
      const updatedRules = customRules.map(r => r.category === deletedCat ? { ...r, category: firstAvailable } : r);
      onUpdateRules(updatedRules);
    }
  };

  const startEditingCategory = (index: number) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  };

  const saveEditCategory = () => {
    if (editingIndex !== null && editingValue.trim()) {
      const oldCat = categories[editingIndex];
      const newCat = editingValue.trim();
      if (oldCat !== newCat) {
        if (onRenameCategory) {
          onRenameCategory(oldCat, newCat);
        } else {
          const newList = [...categories];
          newList[editingIndex] = newCat;
          onUpdate(newList);
          const updatedRules = customRules.map(r => r.category === oldCat ? { ...r, category: newCat } : r);
          onUpdateRules(updatedRules);
        }
      }
      setEditingIndex(null);
    }
  };

  // Rule Handlers
  const handleSaveRule = () => {
    if (!rulePattern.trim()) return;
    
    if (editingRuleId) {
      // Editing existing rule
      const duplicate = customRules.some(
        r => r.id !== editingRuleId && 
        r.pattern.toLowerCase().replace(/\s+/g, '') === rulePattern.trim().toLowerCase().replace(/\s+/g, '')
      );
      if (duplicate) {
        alert('동일한 키워드를 사용하는 다른 규칙이 이미 존재합니다.');
        return;
      }

      const updated = customRules.map(r => {
        if (r.id === editingRuleId) {
          return {
            ...r,
            pattern: rulePattern.trim(),
            category: ruleCategory || categories[0] || '미분류',
            priority: Number(rulePriority) || 10,
            description: ruleDesc.trim() || undefined
          };
        }
        return r;
      });
      onUpdateRules(updated);
      handleCancelEditRule();
    } else {
      // Adding new rule
      const duplicate = customRules.some(
        r => r.pattern.toLowerCase().replace(/\s+/g, '') === rulePattern.trim().toLowerCase().replace(/\s+/g, '')
      );
      if (duplicate) {
        alert('동일한 키워드를 사용하는 규칙이 이미 존재합니다.');
        return;
      }

      const newRule: CustomClassificationRule = {
        id: Date.now().toString(),
        pattern: rulePattern.trim(),
        category: ruleCategory || categories[0] || '미분류',
        isEnabled: true,
        priority: Number(rulePriority) || 10,
        description: ruleDesc.trim() || undefined
      };

      onUpdateRules([...customRules, newRule]);
      setRulePattern('');
      setRuleDesc('');
      setRulePriority(10);
    }
  };

  const handleDeleteRule = (id: string) => {
    const target = customRules.find(r => r.id === id);
    const patternName = target ? target.pattern : '선택한 규칙';
    if (window.confirm(`'${patternName}' 분류 규칙을 삭제하시겠습니까?`)) {
      if (editingRuleId === id) {
        handleCancelEditRule();
      }
      const updated = customRules.filter(r => r.id !== id);
      onUpdateRules(updated);
    }
  };

  const handleToggleRule = (id: string) => {
    const updated = customRules.map(r => r.id === id ? { ...r, isEnabled: !r.isEnabled } : r);
    onUpdateRules(updated);
  };

  const handleIncreasePriority = (id: string) => {
    const updated = customRules.map(r => r.id === id ? { ...r, priority: (r.priority ?? 10) + 1 } : r);
    onUpdateRules(updated);
  };

  const handleDecreasePriority = (id: string) => {
    const updated = customRules.map(r => r.id === id ? { ...r, priority: Math.max(0, (r.priority ?? 10) - 1) } : r);
    onUpdateRules(updated);
  };

  const handleSetPriority = (id: string, val: number) => {
    const updated = customRules.map(r => r.id === id ? { ...r, priority: isNaN(val) ? 0 : val } : r);
    onUpdateRules(updated);
  };

  const handleRunActiveRules = () => {
    if (onApplyRules) {
      onApplyRules(customRules);
    }
  };

  const filteredRules = customRules.filter(r => {
    const matchesSearch = 
      r.pattern.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      r.category.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(ruleSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (filterOnlyLowSuccess) {
      const stat = statsMap.get(r.id);
      return isLowSuccessRule(stat);
    }

    return true;
  });

  // Stats Calculation
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number; materialAmount: number; laborAmount: number }> = {};
    
    // Initialize all categories
    categories.forEach(cat => {
      stats[cat] = { count: 0, totalAmount: 0, materialAmount: 0, laborAmount: 0 };
    });
    
    // Unclassified category
    stats['미분류'] = { count: 0, totalAmount: 0, materialAmount: 0, laborAmount: 0 };
    
    const getItemAmount = (item: SpecItem): number => {
      if (item.amount && item.amount > 0) return item.amount;
      if (item.materialAmount || item.laborAmount) {
        return (item.materialAmount || 0) + (item.laborAmount || 0);
      }
      if (item.quantity && item.unitPrice) {
        return item.quantity * item.unitPrice;
      }
      return 0;
    };

    // Calculate totals
    let grandTotalAmount = 0;
    let grandTotalCount = 0;
    let grandMaterialAmount = 0;
    let grandLaborAmount = 0;
    
    items.forEach(item => {
      const itemCat = item.category || '미분류';
      const matAmt = getItemMaterialCost(item);
      const labAmt = getItemLaborCost(item);

      const isSpecial = isOutsourcingCategory(itemCat) || isIndirectCostCategory(itemCat) || isClientSuppliedCategory(itemCat);

      if (isSpecial) {
        // Keep everything in the special category
        if (!stats[itemCat]) stats[itemCat] = { count: 0, totalAmount: 0, materialAmount: 0, laborAmount: 0 };
        stats[itemCat].count++;
        stats[itemCat].totalAmount += (matAmt + labAmt);
        stats[itemCat].materialAmount += matAmt;
        stats[itemCat].laborAmount += labAmt;
      } else {
        // Normal material category: Split labor to '간접비'
        // 1. Material stays in original category
        if (!stats[itemCat]) stats[itemCat] = { count: 0, totalAmount: 0, materialAmount: 0, laborAmount: 0 };
        stats[itemCat].materialAmount += matAmt;
        stats[itemCat].totalAmount += matAmt;
        if (matAmt > 0) stats[itemCat].count++;

        // 2. Labor moves to '간접비'
        if (labAmt > 0) {
          const indirectCat = '간접비';
          if (!stats[indirectCat]) stats[indirectCat] = { count: 0, totalAmount: 0, materialAmount: 0, laborAmount: 0 };
          stats[indirectCat].laborAmount += labAmt;
          stats[indirectCat].totalAmount += labAmt;
          stats[indirectCat].count++;
        }
      }

      grandTotalAmount += (matAmt + labAmt);
      grandTotalCount++;
      grandMaterialAmount += matAmt;
      grandLaborAmount += labAmt;
    });
    
    const sortedCategories = Object.entries(stats)
      .map(([name, data]) => ({
        name,
        ...data,
        percentage: grandTotalAmount > 0 ? (data.totalAmount / grandTotalAmount) * 100 : 0,
        countPercentage: grandTotalCount > 0 ? (data.count / grandTotalCount) * 100 : 0
      }))
      .filter(s => s.count > 0 || categories.includes(s.name))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      byCategory: sortedCategories,
      grandTotalAmount,
      grandTotalCount,
      grandMaterialAmount,
      grandLaborAmount
    };
  }, [items, categories]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl w-full ${activeTab === 'rules' || activeTab === 'stats' || activeTab === 'patternStats' ? 'max-w-2xl md:max-w-3xl lg:max-w-4xl' : 'max-w-md'} shadow-2xl overflow-hidden flex flex-col h-[85vh] transition-all duration-300`}>
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              {activeTab === 'categories' ? (
                <Tags className="w-5 h-5 text-white" />
              ) : (
                <Sliders className="w-5 h-5 text-white" />
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              {activeTab === 'categories' 
                ? '카테고리 및 분류 규칙 관리' 
                : activeTab === 'patternStats' 
                  ? '지능형 패턴 성공/실패율 통계 분석' 
                  : activeTab === 'stats' 
                    ? '카테고리별 예산 분석 리포트' 
                    : '자동 분류 규칙 설정'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs Control */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <Tags className="w-4 h-4" />
            <span>카테고리 관리</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>분류 규칙 설정</span>
            {lowSuccessRules.length > 0 && (
              <span 
                className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center gap-0.5 shadow-2xs animate-pulse"
                title={`성공률 50% 이하 규칙 ${lowSuccessRules.length}건 (수정/삭제 권장)`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {lowSuccessRules.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('patternStats')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'patternStats'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <Activity className="w-4 h-4 text-indigo-500" />
            <span>패턴 성공/실패율 통계</span>
            {lowSuccessRules.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold rounded-full">
                {lowSuccessRules.length}건 주의
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'stats'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>예산 분석 리포트</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-grow space-y-4">
          
          {activeTab === 'categories' ? (
            /* --- CATEGORIES TAB --- */
            <div className="space-y-4">
              <div className="text-xs text-slate-500 flex items-center gap-1.5 p-2 bg-indigo-50 border border-indigo-100/50 rounded-lg">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>카테고리의 이름을 추가하거나 편집할 수 있습니다. 규칙에 사용된 원본 이름도 연동됩니다.</span>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="새 카테고리 이름 입력 (예: 소방배관, 위생도기)..."
                  className="flex-grow px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddCategory()}
                />
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold shadow-md shadow-indigo-100 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>추가</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">양식 파일로 일괄 등록</span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 rounded-lg text-[11px] font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isImporting ? '처리 중...' : '엑셀 업로드'}
                  </button>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBulkImport}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  엑셀 파일의 **첫 번째 열(A열)**에 등록할 카테고리 이름들을 나열하여 업로드해 주세요. 
                  기존 목록에 없는 항목만 자동으로 추가됩니다.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700">
                  현재 등록된 카테고리 ({categories.length}개)
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaultCategories}
                  className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="31개 기본 카테고리 세트로 복구"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>기본 목록 복구</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {categories.map((cat, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors"
                  >
                    {/* Color Picker */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setShowColorPickerFor(showColorPickerFor === idx ? null : idx)}
                        className="w-5 h-5 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: categoryColors[cat] || '#e2e8f0' }}
                        title="색상 변경"
                      />
                      {showColorPickerFor === idx && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowColorPickerFor(null)} 
                          />
                          <div className="absolute top-full left-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 grid grid-cols-6 gap-1 w-36">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  if (onUpdateColors) {
                                    onUpdateColors({ ...categoryColors, [cat]: color });
                                  }
                                  setShowColorPickerFor(null);
                                }}
                                className={`w-4 h-4 rounded-full border border-slate-100 hover:scale-110 transition-transform ${categoryColors[cat] === color ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {editingIndex === idx ? (
                      <>
                        <input 
                          type="text" 
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-grow px-3 py-1 border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 text-slate-800 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && saveEditCategory()}
                        />
                        <button onClick={saveEditCategory} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-md">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-grow font-medium text-slate-700 text-sm">{cat}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => startEditingCategory(idx)}
                            className="p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 rounded-md shadow-sm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(idx)}
                            className="p-1.5 text-slate-400 hover:bg-white hover:text-red-600 rounded-md shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'rules' ? (
            /* --- RULES TAB (CLASSIFICATION RULES) --- */
            <div className="space-y-6">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs">
                <div className="font-black text-slate-700 mb-2">기본 자동 분류 규칙 (사용자 규칙보다 먼저 적용)</div>
                <ul className="space-y-1.5 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">설계변경</span>
                    <span>품명·규격·단위는 있는데 <b>수량 0</b>, <b>단가 0원</b>(재료비·노무비·합계)인 품목</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">외주-덕트공사</span>
                    <span><b>환기덕트</b> 공정의 모든 품목 (공구손료·잡재료비·페인트칠 포함)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">외주-전열교환기</span>
                    <span><b>전열교환기</b> 공정의 모든 품목 (공구손료·잡재료비·페인트칠 포함)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">지급자재</span>
                    <span><b>수량은 있는데</b> 재료비·노무비 단가가 0원인 품목</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">간접비</span>
                    <span><b>수량은 있는데</b> 재료비 단가 0원, 노무비만 있는 품목</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">스리브+고정틀+내화채움재</span>
                    <span>품명에 <b>스리브</b>가 들어간 품목 (세면기스리브·양변기스리브 내화채움구조 포함)</span>
                  </li>
                </ul>
                <p className="mt-2 text-[10px] text-slate-400">이미 올린 내역에는 아래 [현재 시트 데이터에 분류 규칙 즉시 적용]을 누르면 반영됩니다.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-indigo-600 rounded-2xl shadow-md text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">지능형 자동 규칙 학습</h3>
                    <p className="text-[10px] text-indigo-100 font-medium">품명 분류 시 해당 규칙을 자동 생성/갱신합니다</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('patternStats')}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="각 패턴의 성공률 및 오분류 통계 차트를 확인합니다."
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-300" />
                    <span>성공/실패율 통계 차트</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAutoRuleCreation && onSetAutoRuleCreation(!autoRuleCreation)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoRuleCreation ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                    title="자재 분류 시 해당 품명에 대한 규칙을 자동으로 저장하거나 업데이트합니다."
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        autoRuleCreation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 p-3 bg-indigo-50 border border-indigo-100/50 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-800">
                  <Info className="w-4 h-4" />
                  <span>분류 규칙이란?</span>
                </div>
                <p className="leading-relaxed">
                  특정 <strong>키워드(품명이나 규격)</strong>가 설계 내역 품목의 텍스트에 포함되어 있으면, 지정한 <strong>카테고리</strong>로 자동 분류해 주는 핵심 로직 규칙입니다.
                  사용자 지정 규칙은 시스템 기본 규칙보다 우선해 적용됩니다.
                </p>
              </div>

              {/* Alert banner if low performance rules are detected */}
              {lowSuccessRules.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-rose-900">
                          성공률 50% 이하 분류 패턴 {lowSuccessRules.length}건 감지
                        </span>
                        <span className="px-2 py-0.5 bg-rose-200/90 text-rose-800 text-[10px] font-bold rounded-md">
                          수정 또는 삭제 제안
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        해당 패턴은 다른 카테고리로 변경되는 빈도가 높아 오분류를 유발하고 있습니다. 키워드를 더 구체화하거나 삭제해 주세요.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setFilterOnlyLowSuccess(!filterOnlyLowSuccess)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        filterOnlyLowSuccess
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>{filterOnlyLowSuccess ? '전체 규칙 표시' : '저조 규칙만 필터링'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('patternStats')}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>통계 차트 확인</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Add / Edit Custom Rule Section */}
              <div className={`rounded-xl p-4 space-y-3 transition-colors ${
                editingRuleId 
                  ? 'bg-indigo-50/70 border-2 border-indigo-300 shadow-sm' 
                  : 'bg-slate-50 border border-slate-100'
              }`}>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    {editingRuleId ? (
                      <>
                        <Edit2 className="w-4 h-4 text-indigo-600" />
                        <span>규칙 수정 제안 모드</span>
                        <span className="text-xs font-mono font-medium text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-150">
                          '{rulePattern}'
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>신규 분류 규칙 추가</span>
                      </>
                    )}
                  </h3>

                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={handleCancelEditRule}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      수정 취소
                    </button>
                  )}
                </div>

                {editingRuleId && statsMap.get(editingRuleId) && isLowSuccessRule(statsMap.get(editingRuleId)) && (
                  <div className="p-2.5 bg-rose-100/90 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs text-rose-900">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>성공률 저조 패턴:</strong> 성공률 {statsMap.get(editingRuleId)?.successRate}% ({statsMap.get(editingRuleId)?.totalSuccess}회 성공 / {statsMap.get(editingRuleId)?.totalFailure}회 실패). 
                        더 구체적인 단어로 키워드를 수정하거나, 규칙을 삭제하는 것을 추천합니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(editingRuleId)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px] shrink-0 cursor-pointer"
                    >
                      규칙 삭제하기
                    </button>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">키워드 패턴 (매칭)</label>
                    <input 
                      type="text"
                      placeholder="예: 실린더, 세대수전"
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">매칭할 카테고리</label>
                    <select
                      value={ruleCategory}
                      onChange={(e) => setRuleCategory(e.target.value)}
                      className="w-full px-3 py-[7px] border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 cursor-pointer"
                    >
                      {categories.map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">우선순위(위 단계 매칭)</label>
                    <input 
                      type="number"
                      min="0"
                      placeholder="기본값: 10"
                      value={rulePriority}
                      onChange={(e) => setRulePriority(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-[7px] border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">설명 (메모)</label>
                  <input 
                    type="text"
                    placeholder="예: 현장 수동 배부용 이형관"
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={handleCancelEditRule}
                      className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-all cursor-pointer"
                    >
                      취소
                    </button>
                  )}
                  <button
                    onClick={handleSaveRule}
                    disabled={!rulePattern.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    {editingRuleId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingRuleId ? '수정 내용 저장' : '규칙 추가'}
                  </button>
                </div>
              </div>

              {/* Custom Rules List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-slate-500" />
                      사용자 지정 규칙 리스트 ({customRules.length}개)
                    </h3>
                    {lowSuccessRules.length > 0 && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-full">
                        주의 패턴 {lowSuccessRules.length}개
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {lowSuccessRules.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterOnlyLowSuccess(!filterOnlyLowSuccess)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          filterOnlyLowSuccess 
                            ? 'bg-rose-600 text-white shadow-2xs' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                        title="성공률 50% 이하인 규칙만 필터링합니다"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>저조 규칙만 {filterOnlyLowSuccess ? '해제' : `(${lowSuccessRules.length})`}</span>
                      </button>
                    )}
                    <input 
                      type="text"
                      placeholder="규칙 검색..."
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      className="px-3 py-1 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {filteredRules.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-150 rounded-xl text-slate-400 text-xs">
                      {filterOnlyLowSuccess ? (
                        <span>성공률 50% 이하인 저조 패턴 규칙이 없습니다! 모두 양호합니다.</span>
                      ) : (
                        <span>등록된 사용자 정의 규칙이 없습니다. 위의 추가 폼에서 첫 번째 규칙을 등록해 보세요!</span>
                      )}
                    </div>
                  ) : (
                    [...filteredRules]
                      .sort((a, b) => (b.priority ?? 10) - (a.priority ?? 10))
                      .map((rule, idx) => {
                        const stat = statsMap.get(rule.id);
                        const isLowSuccess = isLowSuccessRule(stat);
                        const isCurrentlyEditing = editingRuleId === rule.id;

                        return (
                          <div 
                            key={rule.id}
                            className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                              isCurrentlyEditing
                                ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200'
                                : isLowSuccess
                                  ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200/90 shadow-2xs'
                                  : rule.isEnabled
                                    ? 'bg-white border-slate-200 hover:border-slate-300'
                                    : 'bg-slate-50/50 border-slate-100 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-grow">
                              <span 
                                className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 select-none mt-0.5 ${
                                  isLowSuccess
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : rule.isEnabled 
                                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                      : 'bg-slate-100 text-slate-400'
                                }`}
                                title={`매칭 평가 순서 - #${idx + 1}`}
                              >
                                {idx + 1}
                              </span>
                              <div className="space-y-1 min-w-0 flex-grow">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800 text-sm break-all">'{rule.pattern}'</span>
                                  <span className="text-slate-400 text-xs text-nowrap">포함되면</span>
                                  <span className="px-2 py-0.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 font-bold rounded-full">
                                    {rule.category}
                                  </span>

                                  {/* Low success alert badge */}
                                  {isLowSuccess && (
                                    <span className="px-2 py-0.5 text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 rounded-md flex items-center gap-1 shadow-2xs animate-pulse">
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      성공률 저조 {stat?.successRate}% ({stat?.totalSuccess}성공/{stat?.totalFailure}실패)
                                    </span>
                                  )}

                                  {/* Normal evaluated badge */}
                                  {!isLowSuccess && stat && stat.totalEvaluations > 0 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      성공률 {stat.successRate}% ({stat.totalSuccess}성공/{stat.totalFailure}실패)
                                    </span>
                                  )}
                                </div>
                                {rule.description && (
                                  <p className="text-xs text-slate-500 truncate">{rule.description}</p>
                                )}
                                {isLowSuccess && (
                                  <p className="text-[11px] text-rose-700 font-medium">
                                    ⚠️ 사용자가 다른 카테고리로 변경하는 비율이 높습니다. 키워드를 더 구체화하거나 삭제를 제안합니다.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                              {/* Dedicated Edit / Delete suggestion buttons for low success rules */}
                              {isLowSuccess && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectRuleForEdit(rule.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                                    title="키워드를 구체적으로 수정 제안"
                                  >
                                    <Edit2 className="w-3 h-3 text-indigo-600" />
                                    <span>수정 제안</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
                                    title="성공률이 낮은 패턴 규칙 삭제 제안"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>삭제 제안</span>
                                  </button>
                                </div>
                              )}

                              {/* Priority controller */}
                              <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-150">
                                <span className="text-[10px] font-semibold text-slate-400 select-none" title="우선순위가 높을수록 먼저 분류 적용을 수행합니다.">우선순위:</span>
                                <input 
                                  type="number"
                                  min="0"
                                  value={rule.priority ?? 10}
                                  onChange={(e) => handleSetPriority(rule.id, Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-8 text-center bg-transparent text-xs font-bold text-slate-800 outline-none p-0 border-none focus:ring-0"
                                />
                                <div className="flex flex-col">
                                  <button 
                                    onClick={() => handleIncreasePriority(rule.id)}
                                    className="p-px text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                    title="순위 높이기(+1)"
                                  >
                                    <ChevronUp className="w-3" />
                                  </button>
                                  <button 
                                    onClick={() => handleDecreasePriority(rule.id)}
                                    className="p-px text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                    title="순위 낮추기(-1)"
                                  >
                                    <ChevronDown className="w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Toggle active switch */}
                              <button
                                onClick={() => handleToggleRule(rule.id)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 cursor-pointer ${
                                  rule.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                                title={rule.isEnabled ? '규칙 활성화됨' : '규칙 비활성화됨'}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  rule.isEnabled ? 'translate-x-[16px]' : 'translate-x-0'
                                }`} />
                              </button>

                              {/* Normal Edit and Delete buttons if not low success */}
                              {!isLowSuccess && (
                                <>
                                  <button
                                    onClick={() => handleSelectRuleForEdit(rule.id)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 shrink-0 cursor-pointer"
                                    title="규칙 수정"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 shrink-0 cursor-pointer"
                                    title="규칙 삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Trigger manual matching on current rows */}
              {onApplyRules && customRules.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleRunActiveRules}
                    className="text-xs font-bold px-4 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-medium text-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    현재 시트 데이터에 분류 규칙 즉시 적용 (분류 재적용)
                  </button>
                </div>
              )}

              {/* System Built-in Reference Collapsible section */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSystemRules(!showSystemRules)}
                  className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-150 transition-colors text-slate-700 font-bold text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    시스템 기본 분류 규칙 목록 참고 ({Object.keys(SYSTEM_MAPPING_RULES).length}개)
                  </span>
                  <span>{showSystemRules ? '접기 ▲' : '열기 ▼'}</span>
                </button>

                {showSystemRules && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-[20vh] overflow-y-auto">
                    {Object.entries(SYSTEM_MAPPING_RULES).map(([key, value]) => (
                      <div key={key} className="p-1.5 bg-white border border-slate-150 rounded flex justify-between gap-1 items-center">
                        <span className="font-semibold text-slate-600 truncate max-w-[60%]">{key}</span>
                        <span className="px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'patternStats' ? (
            /* --- PATTERN STATS TAB (ACCURACY / SUCCESS & FAILURE CHART) --- */
            <div className="space-y-6">
              <PatternAccuracyChart
                customRules={customRules}
                items={items}
                onSelectRuleForEdit={handleSelectRuleForEdit}
                onResetRuleStats={handleResetRuleStats}
                onDeleteRule={handleDeleteRule}
              />
            </div>
          ) : (
            /* --- STATS TAB (REPORT) --- */
            <div className="space-y-6">
              {/* Report Subheader Switcher */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-white text-indigo-700 font-bold rounded-lg text-xs shadow-xs"
                  >
                    카테고리별 비중 및 집계
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('patternStats')}
                    className="px-3 py-1.5 text-slate-600 hover:text-indigo-600 font-medium rounded-lg text-xs transition-colors flex items-center gap-1"
                  >
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <span>패턴 성공/실패율 통계 보기</span>
                  </button>
                </div>
              </div>

              {/* Overall Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">전체 총계약 금액 (100%)</span>
                  <div className="text-xl font-black text-indigo-950 mt-1">
                    ₩{categoryStats.grandTotalAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-indigo-600/80 mt-1">
                    100.0% 기준 총액
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">자재비 합계</span>
                  <div className="text-xl font-black text-blue-950 mt-1">
                    ₩{categoryStats.grandMaterialAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-blue-600 mt-1">
                    전체의 {categoryStats.grandTotalAmount > 0 ? ((categoryStats.grandMaterialAmount / categoryStats.grandTotalAmount) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">외주비 합계</span>
                  <div className="text-xl font-black text-amber-950 mt-1">
                    ₩{categoryStats.grandLaborAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-amber-700 mt-1">
                    전체의 {categoryStats.grandTotalAmount > 0 ? ((categoryStats.grandLaborAmount / categoryStats.grandTotalAmount) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              {/* 100% Stacked Category Composition Bar */}
              {categoryStats.grandTotalAmount > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      전체 예산 100% 구성 비율 분포
                    </span>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      총 {categoryStats.grandTotalCount}건 / 100%
                    </span>
                  </div>

                  {/* Multi-segmented 100% bar */}
                  <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                    {categoryStats.byCategory
                      .filter(cat => cat.percentage > 0)
                      .map((cat, idx) => (
                        <div
                          key={idx}
                          className="h-full transition-all hover:opacity-90 relative group cursor-pointer"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: categoryColors[cat.name] || '#6366f1'
                          }}
                          title={`${cat.name}: ${cat.percentage.toFixed(1)}% (₩${cat.totalAmount.toLocaleString()})`}
                        />
                      ))}
                  </div>

                  {/* Mini legend of top categories */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px]">
                    {categoryStats.byCategory
                      .filter(cat => cat.percentage > 0)
                      .slice(0, 6)
                      .map((cat, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: categoryColors[cat.name] || '#6366f1' }}
                          />
                          <span className="font-bold text-slate-600">{cat.name}</span>
                          <span className="font-mono font-black text-indigo-700">{cat.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Detailed Category List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    카테고리별 비중(%) 및 상세 점유율
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">비중 높은 순</span>
                </div>

                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                  {categoryStats.byCategory.map((cat, idx) => (
                    <div key={idx} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-indigo-300 transition-all">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                            style={{ backgroundColor: categoryColors[cat.name] || '#e2e8f0' }} 
                          />
                          <span className="text-sm font-black text-slate-800 truncate">{cat.name}</span>
                          {cat.name === '미분류' && cat.count > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                              분류 필요
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block leading-tight">금액 비중</span>
                            <span className="text-sm font-mono font-black text-indigo-600">{cat.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="text-right border-l border-slate-100 pl-3">
                            <span className="text-[10px] font-bold text-slate-400 block leading-tight">품목 점유</span>
                            <span className="text-xs font-mono font-bold text-slate-700">{cat.count}건 <span className="text-[10px] text-slate-400 font-normal">({cat.countPercentage.toFixed(1)}%)</span></span>
                          </div>
                        </div>
                      </div>

                      {/* Individual Category Progress Bar */}
                      <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden my-1.5">
                        <div 
                          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-full shadow-xs"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, cat.percentage))}%`,
                            backgroundColor: categoryColors[cat.name] || '#6366f1'
                          }}
                        />
                      </div>
                      
                      <div className="flex justify-between items-center mt-1.5 text-xs">
                        <span className="text-[11px] font-bold text-slate-500">
                          합계 금액
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-slate-900">
                            ₩{cat.totalAmount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {categoryStats.grandTotalCount === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <BarChart3 className="w-12 h-12 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">분석할 데이터가 없습니다.<br/>내역서 파일을 먼저 업로드해 주세요.</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-150 text-sm"
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
}
