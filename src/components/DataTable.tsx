import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SpecItem, ProcessCodeEntry, ThemeType } from '../types';
import { Download, Table, Cpu, Filter, Maximize2, RotateCcw, Zap, Sparkles, AlertTriangle, User, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers, X, Search, History, ListTree } from 'lucide-react';
import ExcelUpload from './ExcelUpload';
import { buildSectionDisplayInfo } from '../utils/sectionHierarchy';
import * as XLSX from 'xlsx';
import { exportStyledExcel } from '../utils/excelExport';
import { VirtualizedTableBody, VirtualRowData } from './VirtualizedTableBody';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  getItemContractAmount,
  getItemQuantity,
  calculateCostBreakdown,
  isOutsourcingCategory,
  isOutsourcingItem,
  isIndirectCostCategory,
  isClientSuppliedCategory,
  isSafetyEquipmentItem
} from '../utils/costCalculation';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  categoryColors?: Record<string, string>;
  workbook: XLSX.WorkBook | null;
  onClassify: (targetIds?: string[]) => void;
  isClassifying: boolean;
  onUpdateCategory: (id: string, category: string) => void;
  onAddCategory: (category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateCategories: (ids: string[], category: string) => void;
  onUpdateSections: (ids: string[], section: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateExecutionAmount: (id: string, amount: number) => void;
  onDataLoaded: (items: SpecItem[], workbook: XLSX.WorkBook, detectedCodes?: ProcessCodeEntry[]) => void;
  processCodes?: ProcessCodeEntry[];
  onOpenProcessCodes?: () => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
  onOpenAnalysis?: () => void;
  onOrganizeSectionHierarchy?: () => void;
}

// Excel-style column filter component
const ColumnFilterDropdown = ({ 
  columnId, 
  value, 
  onValueChange, 
  onClose,
  suggestions = [],
  filterOperator = 'AND',
  onOperatorChange
}: { 
  columnId: 'name' | 'spec', 
  value: string, 
  onValueChange: (val: string) => void,
  onClose: () => void,
  suggestions?: string[],
  filterOperator?: 'AND' | 'OR',
  onOperatorChange?: (op: 'AND' | 'OR') => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState(value);

  // Sync with prop value if it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    // Focus after a short delay to ensure positioning is finalized
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    onValueChange(newVal); // Keep live filtering
  };

  const filteredSuggestions = suggestions.filter(s => 
    !localValue || s.toLowerCase().includes(localValue.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

  return (
    <div 
      className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-xl shadow-2xl z-[1000] p-4 font-sans text-xs ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3 bg-indigo-500 rounded-full" />
          <span className="font-extrabold text-slate-800 uppercase tracking-tight text-[11px]">
            {columnId === 'name' ? '품명 필터' : '규격 필터'}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      
      <div className="relative mb-3">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder="검색어 입력..."
          className="w-full p-2.5 pr-9 border-2 border-slate-100 rounded-lg outline-none focus:border-indigo-500 font-bold text-slate-900 bg-slate-50 placeholder:text-slate-400 transition-all text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !(e.nativeEvent as KeyboardEvent).isComposing) onClose();
            if (e.key === 'Escape') onClose();
          }}
        />
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {onOperatorChange && (
        <div className="flex items-center gap-2 mb-3 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-[10px] font-black text-slate-500 uppercase ml-1">조건:</span>
          <div className="flex bg-white rounded-md border border-slate-200 p-0.5 overflow-hidden flex-1 shadow-sm">
            <button
              onClick={() => onOperatorChange('AND')}
              className={`flex-1 py-1 px-2 rounded-sm text-[10px] font-bold transition-all ${filterOperator === 'AND' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              AND (교집합)
            </button>
            <button
              onClick={() => onOperatorChange('OR')}
              className={`flex-1 py-1 px-2 rounded-sm text-[10px] font-bold transition-all ${filterOperator === 'OR' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              OR (합집합)
            </button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50/50 custom-scrollbar">
          <div className="p-1">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setLocalValue(s);
                    onValueChange(s);
                    onClose(); // Auto-close on selection
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors font-medium truncate text-slate-600 cursor-pointer"
                >
                  {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-slate-400 italic">결과 없음</div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button 
          onClick={() => { onValueChange(''); setLocalValue(''); onClose(); }}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-black transition-all cursor-pointer active:scale-95 text-[10px]"
        >
          초기화
        </button>
        <button 
          onClick={onClose}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all cursor-pointer shadow-md shadow-indigo-200 active:scale-95 text-[10px]"
        >
          필터 적용
        </button>
      </div>
    </div>
  );
};

export default function DataTable({ 
  items, 
  theme, 
  categories, 
  categoryColors = {},
  workbook, 
  onClassify, 
  isClassifying, 
  onUpdateCategory, 
  onAddCategory, 
  onRevertCategory, 
  onUpdateCategories, 
  onUpdateSections,
  onUpdateMemo, 
  onUpdateExecutionAmount, 
  onDataLoaded, 
  categoryFilter = 'all', 
  onCategoryFilterChange,
  onOpenAnalysis,
  onOrganizeSectionHierarchy,
  processCodes,
  onOpenProcessCodes
}: Props) {
  const [viewMode, setViewMode] = useState<'process' | 'category' | 'unclassified'>('process');
  const [costViewType, setCostViewType] = useState<'total' | 'material' | 'labor'>('total');
  const [showAggregated, setShowAggregated] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 카테고리 일괄 변경: 목록에 없는 이름이면 바로 만들지 않고 확인을 받음
  const [pendingNewCategory, setPendingNewCategory] = useState<string | null>(null);
  const bulkCategoryInputRef = useRef<HTMLInputElement>(null);

  const applyBulkCategory = (raw: string, allowNew = false) => {
    const val = raw.trim();
    if (!val || selectedIds.size === 0) return;
    const exact = categories.find(c => c === val) || categories.find(c => c.replace(/\s+/g, '') === val.replace(/\s+/g, ''));
    if (!exact && !allowNew) {
      setPendingNewCategory(val);
      return;
    }
    onUpdateCategories(Array.from(selectedIds), exact || val);
    if (bulkCategoryInputRef.current) bulkCategoryInputRef.current.value = '';
    setPendingNewCategory(null);
    setSelectedIds(new Set());
  };

  // 새 카테고리 확인 시, 입력값과 비슷한 기존 카테고리 추천 (한글 입력 중 글자가 덧붙은 경우 등)
  const similarCategories = useMemo(() => {
    if (!pendingNewCategory) return [] as string[];
    const v = pendingNewCategory.replace(/\s+/g, '');
    return categories
      .filter(c => {
        const cc = c.replace(/\s+/g, '');
        return cc.length >= 2 && (v.startsWith(cc) || cc.startsWith(v) || v.includes(cc));
      })
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);
  }, [pendingNewCategory, categories]);

  const [selectionHelper, setSelectionHelper] = useState<{
    id: string;
    name: string;
    count: number;
    ids: string[];
  } | null>(null);
  const [editingId, setEditingId] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const uniqueNames = useMemo(() => {
    const names = new Set<string>();
    items.forEach(item => {
      if (item.name) names.add(item.name);
    });
    return Array.from(names).sort();
  }, [items]);

  const uniqueSpecs = useMemo(() => {
    const specs = new Set<string>();
    items.forEach(item => {
      if (item.specification) specs.add(item.specification);
    });
    return Array.from(specs).sort();
  }, [items]);

  const [containerHeight, setContainerHeight] = useState<number>(600);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tableContainerRef.current) return;
    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const height = Math.round(entries[0].contentRect.height);
      if (height > 100) {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(() => {
          setContainerHeight(prev => (Math.abs(prev - height) >= 4 ? height : prev));
        });
      }
    });
    observer.observe(tableContainerRef.current);
    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const startEditing = (id: string, field: string, value: any) => {
    setEditingId({ id, field });
    setEditValue(String(value));
  };

  const saveEdit = () => {
    if (!editingId) return;
    
    const { id, field } = editingId;
    if (field === 'category') {
      onUpdateCategory(id, editValue);
    } else if (field === 'memo') {
      onUpdateMemo(id, editValue);
    } else if (field === 'executionAmount') {
      const amount = Number(editValue.replace(/[^0-9.-]/g, '')) || 0;
      onUpdateExecutionAmount(id, amount);
    }
    
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.nativeEvent as KeyboardEvent).isComposing) {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [density, setDensity] = useState<number>(2); // 1 to 5 scale
  const [showUnclassifiedOnly, setShowUnclassifiedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<{name: string, spec: string}>({ name: '', spec: '' });
  const [filterOperator, setFilterOperator] = useState<'AND' | 'OR'>('AND');
  const [activeFilterColumn, setActiveFilterColumn] = useState<'name' | 'spec' | null>(null);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    items.forEach(item => {
      if (item.section) sections.add(item.section);
    });
    return Array.from(sections).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSection = sectionFilter === 'all' || item.section === sectionFilter;
      const matchesCategory = categoryFilter === 'all' || 
        (categoryFilter === '미분류' && (!item.category || item.category === '미분류')) ||
        item.category === categoryFilter;
      const matchesUnclassifiedOnly = !showUnclassifiedOnly || (!item.category || item.category === '미분류');
      
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.specification && item.specification.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query));

      // Column Specific Filters (Excel Style) with AND/OR logic
      const nameQ = columnFilters.name.trim().toLowerCase();
      const specQ = columnFilters.spec.trim().toLowerCase();

      let matchesColumnGroup = true;
      if (nameQ && specQ) {
        const mName = item.name?.toLowerCase().includes(nameQ);
        const mSpec = item.specification?.toLowerCase().includes(specQ);
        matchesColumnGroup = filterOperator === 'AND' ? (mName && mSpec) : (mName || mSpec);
      } else if (nameQ) {
        matchesColumnGroup = item.name?.toLowerCase().includes(nameQ);
      } else if (specQ) {
        matchesColumnGroup = item.specification?.toLowerCase().includes(specQ);
      }

      return matchesSection && matchesCategory && matchesUnclassifiedOnly && matchesSearch && matchesColumnGroup;
    });
  }, [items, sectionFilter, categoryFilter, showUnclassifiedOnly, searchQuery, columnFilters, filterOperator]);

  const allMatchingItems = useMemo(() => {
    if (viewMode === 'unclassified') {
      return items.filter(item => {
        const isUnclassified = !item.category || item.category === '미분류';
        const matchesSection = sectionFilter === 'all' || item.section === sectionFilter;
        
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query || 
          (item.name && item.name.toLowerCase().includes(query)) ||
          (item.specification && item.specification.toLowerCase().includes(query));

        return isUnclassified && matchesSection && matchesSearch;
      });
    }
    return filteredItems;
  }, [items, viewMode, filteredItems, sectionFilter, searchQuery]);

  // Reset helper whenever filters or search query changes
  useEffect(() => {
    setSelectionHelper(null);
  }, [sectionFilter, categoryFilter, showUnclassifiedOnly, searchQuery, viewMode]);

  const pageItems = allMatchingItems;

  const costBreakdown = useMemo(() => calculateCostBreakdown(allMatchingItems), [allMatchingItems]);

  const unclassifiedCount = useMemo(() => {
    return items.filter(item => !item.category || item.category === '미분류').length;
  }, [items]);

  // 전체 품목 기준 상위 공정 경로 (필터와 무관하게 동일한 경로가 나오도록 items 전체로 계산)
  const sectionDisplayInfo = useMemo(() => buildSectionDisplayInfo(items), [items]);

  // Transform filtered and paginated/all items into flat VirtualRowData[] for virtualized rendering
  const virtualRows = useMemo<VirtualRowData[]>(() => {
    const targetItems = pageItems;
    if (targetItems.length === 0) return [];

    const rows: VirtualRowData[] = [];

    if (viewMode === 'category') {
      const itemsByCategory: Record<string, Record<string, SpecItem[]>> = {};
      targetItems.forEach(item => {
        const cat = item.category || '기타';
        const sec = item.section || '기본 내역';
        if (!itemsByCategory[cat]) itemsByCategory[cat] = {};
        if (!itemsByCategory[cat][sec]) itemsByCategory[cat][sec] = [];
        itemsByCategory[cat][sec].push(item);
      });

      const sortedCategories = Object.entries(itemsByCategory).sort((a, b) => {
        const idxA = categories.indexOf(a[0]);
        const idxB = categories.indexOf(b[0]);
        const getVal = (idx: number) => idx === -1 ? 9999 : idx;
        return getVal(idxA) - getVal(idxB);
      });

      sortedCategories.forEach(([catName, sections], catIdx) => {
        const catItems = Object.values(sections).flat();
        const catMaterialTotal = catItems.reduce((sum, i) => sum + getItemMaterialCost(i), 0);
        const catLaborTotal = catItems.reduce((sum, i) => sum + getItemLaborCost(i), 0);
        const catTotal = catItems.reduce((sum, i) => sum + getItemContractAmount(i), 0);

        rows.push({
          type: 'category-header',
          catName,
          catIdx,
          materialTotal: catMaterialTotal,
          laborTotal: catLaborTotal,
          total: catTotal,
          count: catItems.length,
          items: catItems,
        });

        if (showAggregated) {
          const aggregatedMap = new Map<string, SpecItem>();
          catItems.forEach(item => {
            const itemQty = getItemQuantity(item);
            const key = `${item.name}|${item.specification || ''}|${item.unit || ''}|${item.unitPrice}`;
            if (!aggregatedMap.has(key)) {
              aggregatedMap.set(key, { ...item, id: `agg-${key}`, quantity: itemQty, amount: item.amount });
            } else {
              const existing = aggregatedMap.get(key)!;
              existing.quantity += itemQty;
              existing.amount += item.amount;
              existing.materialAmount = (existing.materialAmount || 0) + (item.materialAmount || 0);
              existing.laborAmount = (existing.laborAmount || 0) + (item.laborAmount || 0);
            }
          });

          Array.from(aggregatedMap.values()).forEach((aggItem, aggIdx) => {
            rows.push({
              type: 'item',
              item: aggItem,
              itemIdx: aggIdx,
              isAggregated: true,
            });
          });
        } else {
          Object.entries(sections).forEach(([secName, secItems]) => {
            rows.push({
              type: 'category-sub-header',
              secName,
              count: secItems.length,
            });

            secItems.forEach((item, itemIdx) => {
              rows.push({
                type: 'item',
                item,
                itemIdx,
                isAggregated: false,
              });
            });
          });
        }
      });
    } else {
      // Process / Unclassified View — 상위 공정 경로까지 같은 품목끼리 묶음 (같은 이름의 하위공정도 상위가 다르면 분리)
      const itemsBySection: Record<string, SpecItem[]> = {};
      const groupInfo: Record<string, { parents: string[]; title: string }> = {};
      targetItems.forEach(item => {
        const sec = item.section || '기본 내역';
        const info = sectionDisplayInfo.get(item.id);
        const key = info?.key || sec;
        if (!itemsBySection[key]) {
          itemsBySection[key] = [];
          groupInfo[key] = { parents: info?.parents || [], title: info?.title || sec };
        }
        itemsBySection[key].push(item);
      });

      Object.entries(itemsBySection).forEach(([groupKey, sectionItems], index) => {
        const sectionName = sectionItems[0]?.section || '기본 내역';
        const secMaterialTotal = sectionItems.reduce((sum, i) => sum + getItemMaterialCost(i), 0);
        const secLaborTotal = sectionItems.reduce((sum, i) => sum + getItemLaborCost(i), 0);
        const secTotal = sectionItems.reduce((sum, i) => sum + getItemContractAmount(i), 0);

        rows.push({
          type: 'section-header',
          sectionName,
          parents: groupInfo[groupKey].parents,
          title: groupInfo[groupKey].title,
          index,
          materialTotal: secMaterialTotal,
          laborTotal: secLaborTotal,
          total: secTotal,
          count: sectionItems.length,
          items: sectionItems,
        });

        sectionItems.forEach((item, itemIdx) => {
          rows.push({
            type: 'item',
            item,
            itemIdx,
            isAggregated: false,
          });
        });
      });
    }

    return rows;
  }, [pageItems, viewMode, categories, showAggregated, sectionDisplayInfo]);

  const themeStyles = {
    industrial: {
      table: 'bg-slate-900 text-slate-300 border-slate-800',
      header: 'bg-slate-800 text-slate-100',
      row: 'border-slate-800 hover:bg-slate-800/50',
      badge: 'bg-blue-900/30 text-blue-400 border-blue-800/50'
    },
    modern: {
      table: 'bg-white text-slate-700 border-slate-200',
      header: 'bg-slate-50 text-slate-900',
      row: 'border-slate-100 hover:bg-indigo-50/30',
      badge: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    minimal: {
      table: 'bg-white text-zinc-900 border-zinc-200',
      header: 'bg-zinc-100/50 text-zinc-900',
      row: 'border-zinc-100 hover:bg-zinc-50',
      badge: 'bg-zinc-100 text-zinc-600 border-zinc-200'
    },
    'high-density': {
      table: 'bg-white text-[#141414] border-[#141414]',
      header: 'bg-[#F2F2F2] text-[#141414] uppercase text-[11px] font-bold border-b border-[#141414]',
      row: 'hover:bg-gray-50 border-gray-200',
      badge: 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }[theme];

  const getCellPadding = React.useCallback((isHeader = false) => {
    // Map density (1-5) to tailwind padding classes
    const pyMap = theme === 'high-density'
      ? ['py-0.5', 'py-0.5', 'py-1', 'py-1.5', 'py-2.5'] // Even tighter for high-density
      : ['py-0.5', 'py-1', 'py-1.5', 'py-3', 'py-5'];
    
    // Header padding should be slightly more balanced
    const pyHeaderMap = theme === 'high-density'
      ? ['py-1', 'py-1', 'py-1.5', 'py-2', 'py-3']
      : ['py-2', 'py-4', 'py-4', 'py-5', 'py-6'];

    const pyValue = isHeader ? pyHeaderMap[density - 1] : pyMap[density - 1];
    const pxMap = theme === 'high-density' 
      ? ['px-1.5', 'px-2', 'px-4', 'px-6', 'px-8'] 
      : ['px-2', 'px-4', 'px-6', 'px-8', 'px-10'];
      
    return `${pyValue} ${pxMap[density - 1]}`;
  }, [theme, density]);

  const renderRuleIndicator = React.useCallback((item: SpecItem) => {
    if (showAggregated) return null;

    let type: 'custom' | 'system' | 'manual' | 'warning' | 'auto' = 'auto';
    let titleText = '자동 공정 매칭';
    let descriptionText = '내장 스마트 알고리즘에 의해 자동 분류가 적용되었습니다.';
    let ruleDetails = item.remark || '';
    let IconComponent = Cpu;
    let colorClass = 'text-blue-600 bg-blue-50 border-blue-100';

    const isCustom = item.remark && item.remark.includes('사용자 정의 규칙');
    const isManual = item.recommendationSource === 'manual' || (item.originalCategory && item.category !== item.originalCategory);
    const isHistory = item.recommendationSource === 'history';
    const isUnclassified = !item.category || item.category === '미분류';
    const isSimpleFallback = item.remark === item.category;

    if (isHistory) {
      type = 'custom';
      titleText = '과거 학습 데이터 추천 🧠';
      IconComponent = History;
      colorClass = 'text-indigo-700 bg-indigo-50 border-indigo-200';
      descriptionText = '과거에 동일한 품명/규격에 대해 사용자가 지정했던 분류를 자동으로 추천 적용했습니다.';
      ruleDetails = `학습 기반 제안: "${item.category}"`;
    } else if (isManual) {
      type = 'manual';
      titleText = '수동 재지정 처리 완료 👤';
      IconComponent = User;
      colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
      descriptionText = '사용자가 직접 선택 항목의 분류를 수동으로 지정했습니다.';
      ruleDetails = `기존 제안: ${item.originalCategory || '없음'} ➔ 현재 설정: ${item.category}`;
    } else if (isCustom) {
      type = 'custom';
      titleText = '사용자 매칭 규칙 적용 ⚡';
      IconComponent = Zap;
      colorClass = 'text-purple-700 bg-purple-50/80 border-purple-200';
      descriptionText = '사용자 정의 분류 규칙 조건에 매칭되어 자동 분류되었습니다.';
      ruleDetails = item.remark;
    } else if (isUnclassified) {
      type = 'warning';
      titleText = '미분류 및 미지정 상태 ⚠️';
      IconComponent = AlertTriangle;
      colorClass = 'text-red-700 bg-red-50 border-red-200';
      descriptionText = '조건에 맞는 매칭 규칙이 발견되지 않아 미분류 상태입니다.';
      ruleDetails = item.remark || '공정 내역 분석 대기 중';
    } else if (isSimpleFallback) {
      type = 'auto';
      titleText = '내장 키워드 매칭 🤖';
      IconComponent = Cpu;
      colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-150';
      descriptionText = '공정분리 내장 품명/규격 사전 매핑 알고리즘이 적용되었습니다.';
      ruleDetails = `공정분리 지정어: "${item.category}" 매칭`;
    } else {
      type = 'system';
      titleText = 'AI 알고리즘 분석 🤖';
      IconComponent = Sparkles;
      colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      descriptionText = '공종 계층 코드(0101**) 특이사항 및 단가 정보의 복합 해석 규칙이 적용되었습니다.';
      ruleDetails = item.remark;
    }

    return (
      <div className="relative group/tooltip inline-flex items-center shrink-0 select-none ml-1.5" onClick={(e) => e.stopPropagation()}>
        <div 
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all hover:scale-105 cursor-help shadow-xs ${colorClass}`}
        >
          <IconComponent className="w-2.5 h-2.5 shrink-0" />
          <span className="text-[9px] leading-none uppercase">
            {type === 'manual' ? '수동' : isHistory ? '추천' : type === 'custom' ? '규칙' : type === 'warning' ? '미지정' : 'AI'}
          </span>
        </div>

        {/* Dynamic Pure Tailwind Tooltip */}
        <div className="absolute z-[99] bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-900 border border-slate-800 text-white rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 ease-out text-[10px] font-medium whitespace-normal text-left">
          <div className="tooltip-arrow absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
          <div className="flex items-center gap-1.5 font-black text-white pb-1 border-b border-slate-800 mb-1.5">
            <IconComponent className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>{titleText}</span>
          </div>
          <p className="text-slate-300 leading-relaxed mb-2">{descriptionText}</p>
          <div className="bg-slate-950 p-1.5 rounded border border-slate-800/50 font-mono text-[9px] text-indigo-300 break-words">
            <span className="text-slate-400 block font-sans font-bold text-[8px] uppercase tracking-tighter mb-0.5">상세 분석 근거 및 이력:</span>
            {ruleDetails}
          </div>
        </div>
      </div>
    );
  }, [showAggregated]);


  const renderBulkEditToolbar = () => {
    if (selectedIds.size === 0) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`fixed top-3 left-4 right-4 lg:left-[19rem] xl:left-[21rem] z-[60] p-4 border-2 ${
          theme === 'high-density' 
            ? 'bg-indigo-900 border-[#141414] text-white shadow-2xl' 
            : 'bg-indigo-600 border-indigo-700 text-white rounded-xl shadow-xl'
        } flex flex-wrap items-center gap-6`}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">일괄 편집 모드</h3>
            <p className="text-[10px] font-bold text-indigo-100">{selectedIds.size}개의 항목이 선택됨</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/20 hidden lg:block" />

        <div className="flex-grow flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[9px] font-black uppercase text-indigo-100">카테고리 일괄 변경</label>
            <div className="relative">
               <input 
                 type="text"
                 list="category-suggestions"
                 ref={bulkCategoryInputRef}
                 placeholder="변경할 카테고리 입력..."
                 className="w-full px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                 onChange={() => pendingNewCategory && setPendingNewCategory(null)}
                 onKeyDown={(e) => {
                   // 한글 조합 중 Enter 는 무시 (조합 중 Enter 가 두 번 들어와 글자가 덧붙던 문제)
                   if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
                   e.preventDefault();
                   applyBulkCategory((e.target as HTMLInputElement).value);
                 }}
               />
               {pendingNewCategory && (
                 <div className="absolute left-0 top-full mt-1 z-[70] w-[300px] p-3 rounded-lg bg-white text-slate-800 shadow-2xl border border-amber-300 text-xs">
                   <p className="font-bold text-amber-700 mb-2">'{pendingNewCategory}' 은(는) 없는 카테고리입니다.</p>
                   {similarCategories.length > 0 && (
                     <div className="mb-2">
                       <p className="text-[10px] text-slate-500 mb-1">혹시 이 카테고리인가요?</p>
                       <div className="flex flex-wrap gap-1">
                         {similarCategories.map(c => (
                           <button key={c} type="button" onClick={() => applyBulkCategory(c)} className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                             {c}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                   <div className="flex gap-1.5 justify-end">
                     <button type="button" onClick={() => setPendingNewCategory(null)} className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">취소</button>
                     <button type="button" onClick={() => applyBulkCategory(pendingNewCategory, true)} className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold">새 카테고리로 만들기</button>
                   </div>
                 </div>
               )}
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[9px] font-black uppercase text-indigo-100">구간 정보 일괄 변경</label>
            <div className="relative">
               <input 
                 type="text"
                 list="section-suggestions"
                 placeholder="변경할 구간(공종) 입력..."
                 className="w-full px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                     const val = (e.target as HTMLInputElement).value.trim();
                     if (val) {
                       onUpdateSections(Array.from(selectedIds), val);
                       (e.target as HTMLInputElement).value = '';
                       setSelectedIds(new Set());
                     }
                   }
                 }}
               />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
             onClick={() => {
               onClassify(Array.from(selectedIds));
               setSelectedIds(new Set());
             }}
             disabled={isClassifying}
             className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-amber-900/20 active:scale-95 cursor-pointer"
          >
            <Cpu className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin' : ''}`} />
            AI 재분류
          </button>
          
          <button
             onClick={() => setSelectedIds(new Set())}
             className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer border border-white/20"
          >
            <X className="w-3.5 h-3.5" />
            선택 해제
          </button>
        </div>

        <datalist id="section-suggestions">
          {uniqueSections.map(s => <option key={s} value={s} />)}
        </datalist>
      </motion.div>
    );
  };

  const handleDownload = async () => {
    if (items.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    try {
      await exportStyledExcel({
        projectName: '기계설비_공정분리',
        items,
        categories
      });
    } catch (error: any) {
      console.error('Download error:', error);
      alert(error.message || '엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const renderFilters = () => {
    const selectClass = theme === 'high-density'
      ? "text-[11px] font-bold uppercase p-1 bg-white border border-[#141414] focus:outline-none"
      : "text-xs p-2 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none";

    const labelClass = theme === 'high-density'
      ? "text-[11px] font-black uppercase tracking-tighter opacity-70 mb-0.5 block"
      : "text-[10px] font-bold text-slate-500 uppercase mb-1 block";

    return (
      <div className={`flex flex-col sm:flex-row gap-4 items-end ${theme === 'high-density' ? 'mb-2' : 'mb-4'}`}>
        <div className="w-full sm:flex-1 sm:max-w-[240px]">
          <label className={labelClass}>품명 / 규격 검색</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="품명 및 규격 실시간 검색..."
              className={`w-full ${theme === 'high-density'
                ? "text-[11px] font-bold uppercase p-1 bg-white border border-[#141414] focus:outline-none placeholder-gray-400"
                : "text-xs p-2 pl-8 pr-8 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-400"
              }`}
            />
            {theme !== 'high-density' && (
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors font-bold text-xs"
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="w-full sm:flex-1 sm:max-w-[260px]">
          <div className="flex items-center justify-between mb-0.5">
            <label className={labelClass}>공종 필터</label>
            {onOrganizeSectionHierarchy && (
              <button
                type="button"
                onClick={onOrganizeSectionHierarchy}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors"
                title="공종 코드(0101040102 등)를 기반으로 상위 공정명(세대내 난방 배관공사 등)을 계층 구조에 맞게 현재 내역과 보관된 현장에 일괄 반영합니다"
              >
                <Layers size={10} className="text-indigo-600" />
                <span>세부명칭 일괄 반영</span>
              </button>
            )}
          </div>
          <select 
            value={sectionFilter} 
            onChange={(e) => setSectionFilter(e.target.value)}
            className={`w-full ${selectClass}`}
          >
            <option value="all">전체 공종</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:flex-1 sm:max-w-[200px]">
          <label className={labelClass}>카테고리 필터</label>
          <select 
            value={categoryFilter} 
            onChange={(e) => onCategoryFilterChange?.(e.target.value)}
            className={`w-full ${selectClass}`}
          >
            <option value="all">전체 카테고리</option>
            <option value="미분류">⚠️ 미분류 / 미지정</option>
            {uniqueSections.length > 0 && categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowUnclassifiedOnly(!showUnclassifiedOnly)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center gap-2 border shadow-xs h-[32px] sm:h-[30px] whitespace-nowrap cursor-pointer ${
              showUnclassifiedOnly
                ? theme === 'high-density'
                  ? 'bg-amber-100 text-amber-950 border-[#141414] ring-1 ring-amber-400'
                  : 'bg-amber-500 text-white border-amber-600 shadow-amber-100 font-black'
                : theme === 'high-density'
                  ? 'bg-white text-slate-700 border-[#141414] hover:bg-slate-50'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="카테고리가 분류되지 않은 대상만 필터링합니다."
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showUnclassifiedOnly ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
            <span>⚠️ 미분류 항목만 보기</span>
            <span className={`px-1.5 py-0.5 text-[9px] rounded-sm font-black ${showUnclassifiedOnly ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {unclassifiedCount}
            </span>
          </button>
        </div>

        {(sectionFilter !== 'all' || categoryFilter !== 'all' || showUnclassifiedOnly || searchQuery !== '' || columnFilters.name !== '' || columnFilters.spec !== '') && (
          <button 
            type="button"
            onClick={() => { 
                setSectionFilter('all'); 
                onCategoryFilterChange?.('all'); 
                setShowUnclassifiedOnly(false); 
                setSearchQuery(''); 
                setColumnFilters({ name: '', spec: '' });
                setFilterOperator('AND');
                setSelectionHelper(null);
            }}
            className={`flex items-center gap-1 shrink-0 ${theme === 'high-density' ? 'text-[10px] font-bold border-b border-black cursor-pointer pb-1' : 'text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer pb-1'}`}
          >
            필터 초기화
          </button>
        )}
      </div>
    );
  };

  // For high-density, group items by category
  const renderToolBar = () => {
    const handleBulkCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newCategory = e.target.value;
      if (newCategory && selectedIds.size > 0) {
        onUpdateCategories(Array.from(selectedIds), newCategory);
        setSelectedIds(new Set());
        e.target.value = '';
      }
    };

    if (theme === 'high-density') {
      return (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <span className="px-2 py-1 bg-gray-200 text-[11px] font-bold uppercase rounded-sm border border-gray-300">내역 품목 수: {items.length} (필터: {allMatchingItems.length})</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 text-[11px] font-bold uppercase rounded-sm border border-green-200">AI 프로세서: 온라인</span>
            
            <div className="ml-auto flex flex-wrap gap-4 items-center">
               <div className="flex bg-gray-200 p-0.5 rounded-sm border border-gray-300">
                 <button 
                   onClick={() => setCostViewType('total')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${costViewType === 'total' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   전체
                 </button>
                 <button 
                   onClick={() => setCostViewType('material')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${costViewType === 'material' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   재료비
                 </button>
                 <button 
                   onClick={() => setCostViewType('labor')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${costViewType === 'labor' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   노무비
                 </button>
               </div>
               <div className="flex bg-gray-200 p-0.5 rounded-sm border border-gray-300">
                 <button 
                   onClick={() => setViewMode('process')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${viewMode === 'process' ? 'bg-[#141414] text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   공정별 보기
                 </button>
                 <button 
                   onClick={() => setViewMode('category')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all ${viewMode === 'category' ? 'bg-[#141414] text-white' : 'text-gray-600 hover:text-black'}`}
                 >
                   카테고리별 보기
                 </button>
                 <button 
                   onClick={() => setViewMode('unclassified')}
                   className={`px-3 py-1 text-[9px] font-black uppercase transition-all flex items-center gap-1 border-l border-gray-300 ${
                     viewMode === 'unclassified' 
                       ? 'bg-amber-600 text-white font-bold' 
                       : 'text-amber-700 hover:bg-amber-50 hover:text-amber-900'
                   }`}
                 >
                   ⚠️ 미분류 ({unclassifiedCount})
                 </button>
               </div>
               {viewMode === 'category' && (
                 <button 
                   onClick={() => setShowAggregated(!showAggregated)}
                   className={`px-3 py-1 text-[9px] font-black uppercase border transition-all ${showAggregated ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-300 hover:text-black'}`}
                 >
                   {showAggregated ? '전체 내역 보기' : '품목 집계 보기'}
                 </button>
               )}
               <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-sm">
                 <span className="text-[9px] font-black uppercase opacity-60">간격 조정</span>
                 <input 
                   type="range" 
                   min="1" 
                   max="5" 
                   value={density} 
                   onChange={(e) => setDensity(parseInt(e.target.value))}
                   className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                 />
                 <span className="text-[10px] font-bold w-4">{density}</span>
               </div>
               {onOpenProcessCodes && (
                 <button
                   onClick={onOpenProcessCodes}
                   className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${processCodes && processCodes.length > 0 ? 'bg-white border-[#141414] text-[#141414]' : 'bg-amber-400 border-amber-500 text-black animate-pulse'}`}
                   title="공정분리 전에 현장 공종표(현장명·대·중·소공종·세부단위)를 먼저 등록하세요"
                 >
                   공종표 {processCodes && processCodes.length > 0 ? `(${processCodes.length})` : '등록'}
                 </button>
               )}
               <ExcelUpload onDataLoaded={onDataLoaded} processCodes={processCodes} />
               <button 
                  onClick={() => onClassify()}
                  disabled={isClassifying}
                  className="px-4 py-1 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
               >
                  {isClassifying ? '분석 중...' : '자동 공정 분리 실행'}
               </button>
            </div>
          </div>
          {renderFilters()}
        </div>
      );
    }

    return (
      <div className="flex flex-col mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Table className="w-6 h-6 text-slate-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold truncate">계약 내역 상세 정보</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 md:gap-6 items-center">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm">
              <button 
                onClick={() => setCostViewType('total')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${costViewType === 'total' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                전체
              </button>
              <button 
                onClick={() => setCostViewType('material')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${costViewType === 'material' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                재료비
              </button>
              <button 
                onClick={() => setCostViewType('labor')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${costViewType === 'labor' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                노무비
              </button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('process')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'process' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                공정 중심
              </button>
              <button 
                onClick={() => setViewMode('category')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'category' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                카테고리 중심
              </button>
              <button 
                onClick={() => setViewMode('unclassified')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'unclassified' 
                    ? 'bg-amber-500 text-white shadow-sm font-black' 
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
              >
                <span>⚠️ 미분류 ({unclassifiedCount})</span>
              </button>
            </div>
            {viewMode === 'category' && (
              <button 
                onClick={() => setShowAggregated(!showAggregated)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all ${showAggregated ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {showAggregated ? '전체 내역 보기' : '동일 품목 집계'}
              </button>
            )}
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <Maximize2 className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">셀 간격</span>
                <input 
                   type="range" 
                   min="1" 
                   max="5" 
                   value={density} 
                   onChange={(e) => setDensity(parseInt(e.target.value))}
                   className="w-20 md:w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                 />
               </div>
            </div>
            {onOpenProcessCodes && (
              <button
                onClick={onOpenProcessCodes}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm text-sm font-medium ${processCodes && processCodes.length > 0 ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700' : 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-800'}`}
                title="공정분리 전에 현장 공종표(현장명·대·중·소공종·세부단위)를 먼저 등록하세요"
              >
                <ListTree className="w-4 h-4" />
                {processCodes && processCodes.length > 0 ? `공종표 (${processCodes.length})` : '① 공종표 등록'}
              </button>
            )}
            <ExcelUpload onDataLoaded={onDataLoaded} processCodes={processCodes} />
            <button
              onClick={() => onClassify()}
              disabled={isClassifying}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-sm md:text-base text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 cursor-pointer"
            >
              <Cpu className={`w-4 h-4 ${isClassifying ? 'animate-spin' : ''}`} />
              <span className="whitespace-nowrap">{isClassifying ? '분류 중...' : 'AI 자동 공정분리'}</span>
            </button>
            <button 
              onClick={handleDownload}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white text-sm md:text-base rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap">엑셀 내보내기</span>
            </button>
          </div>
        </div>
        {renderFilters()}
      </div>
    );
  };

  const renderFooter = () => {
    if (theme !== 'high-density') return null;
    return (
      <footer className="p-3 bg-[#EBEAE8] border-t border-[#141414] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold opacity-50">이상 항목 감지</span>
            <span className="text-[11px] font-bold text-slate-900 tracking-tight">발견된 오류 없음 / 통과</span>
          </div>
          <div className="flex flex-col border-l border-[#141414]/10 pl-4">
            <span className="text-[9px] uppercase font-bold opacity-50">분류 로직 버전</span>
            <span className="text-[11px] font-bold uppercase font-mono">Semantic AI v4.2 PRO</span>
          </div>
        </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={onOpenAnalysis}
              className="flex-1 sm:flex-none px-4 py-1 bg-white border border-[#141414] text-[10px] font-bold uppercase transition-colors hover:bg-zinc-50"
            >
              자체 시스템 AI 분석
            </button>
            <button 
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-6 py-1 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-800"
            >
              보고서 출력
            </button>
          </div>
      </footer>
    );
  };

  const toggleAll = React.useCallback((visibleItems: SpecItem[]) => {
    setSelectedIds(prev => {
      const allVisibleSelected = visibleItems.every(item => prev.has(item.id));
      const newSelected = new Set(prev);
      if (allVisibleSelected) {
        visibleItems.forEach(item => newSelected.delete(item.id));
      } else {
        visibleItems.forEach(item => newSelected.add(item.id));
      }
      return newSelected;
    });
    setSelectionHelper(null);
  }, []);

  const toggleOne = React.useCallback((id: string, index: number, isShiftKey = false) => {
    setSelectedIds(prev => {
      const newSelected = new Set(prev);
      const wasSelected = newSelected.has(id);
      
      if (wasSelected && !isDragging) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });

    // Handle selection helper after state update
    const targetItem = items.find(i => i.id === id);
    if (targetItem && targetItem.name) {
      const sameNameItems = items.filter(i => 
        i.name === targetItem.name && 
        i.id !== id
      );
      
      if (sameNameItems.length > 0) {
        setSelectionHelper({
          id,
          name: targetItem.name,
          count: sameNameItems.length,
          ids: sameNameItems.map(i => i.id)
        });
      } else {
        setSelectionHelper(null);
      }
    }
  }, [isDragging, items]);

  const handleMouseDown = React.useCallback((id: string, index: number) => {
    setIsDragging(true);
    setDragStartIdx(index);
    setSelectedIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  }, []);

  const handleMouseEnter = React.useCallback((index: number, buttons?: number) => {
    // 마우스 버튼을 실제로 누르고 있을 때만 드래그 선택 (놓은 뒤 지나가기만 해도 선택되던 문제 방지)
    if (isDragging && buttons !== undefined && (buttons & 1) === 0) {
      setIsDragging(false);
      setDragStartIdx(null);
      return;
    }
    if (isDragging && dragStartIdx !== null && index !== dragStartIdx) {
      const start = Math.min(dragStartIdx, index);
      const end = Math.max(dragStartIdx, index);
      
      setSelectedIds(prev => {
        const newSelected = new Set(prev);
        let changed = false;
        // Use virtualRows to determine which items to select in the range
        for (let i = start; i <= end; i++) {
          const row = virtualRows[i];
          if (row && row.type === 'item') {
            if (!newSelected.has(row.item.id)) {
              newSelected.add(row.item.id);
              changed = true;
            }
          }
        }
        return changed ? newSelected : prev;
      });
    }
  }, [isDragging, dragStartIdx, virtualRows]);


  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartIdx(null);
  };

  // 표 밖에서 마우스를 놓아도 드래그 상태가 풀리도록
  useEffect(() => {
    if (!isDragging) return;
    const up = () => { setIsDragging(false); setDragStartIdx(null); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [isDragging]);

  const selectionSummary = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    return {
      material: selectedItems.reduce((sum, i) => sum + getItemMaterialCost(i), 0),
      labor: selectedItems.reduce((sum, i) => sum + getItemLaborCost(i), 0),
      total: selectedItems.reduce((sum, i) => sum + getItemContractAmount(i), 0),
      count: selectedItems.length
    };
  }, [selectedIds, items]);

  return (
    <div className={`flex flex-col ${theme === 'high-density' ? 'flex-grow overflow-hidden' : 'gap-0'}`} onMouseUp={handleMouseUp}>
      {renderToolBar()}
      {renderBulkEditToolbar()}

      {viewMode === 'unclassified' && (
        <div className={`mx-4 mb-3 p-3 flex flex-wrap items-center justify-between border-l-4 ${
          theme === 'high-density' 
            ? 'bg-amber-100 text-amber-950 border-amber-600 border-y border-r font-sans' 
            : 'bg-amber-50 text-amber-900 border-amber-500 rounded-lg shadow-sm border-y border-r'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">미분류 / 미지정 품목 조회 모드</p>
              <p className="text-[10px] opacity-75 font-medium">자동 분류가 되지 않았거나 아직 지정하지 않은 대상을 빠르게 모아보고 공종을 지정할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <button 
              onClick={() => onClassify(allMatchingItems.map(i => i.id))}
              disabled={isClassifying}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded transition-all flex items-center gap-1 shrink-0 ${
                theme === 'high-density'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 cursor-pointer'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm cursor-pointer'
              }`}
            >
              🚀 {isClassifying ? '자동 분류 진행 중...' : '해당 품목만 AI 분류 실행'}
            </button>
          </div>
        </div>
      )}

      <div ref={tableContainerRef} className={`flex-grow overflow-hidden flex flex-col ${theme === 'high-density' ? '' : `rounded-xl border shadow-sm ${themeStyles.table}`}`}>
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="min-w-[1816px] w-full flex flex-col">
            {/* Header: Exact matching 1816px columns with 2-tier sub-headers */}
            <div className={`sticky top-0 z-20 select-none shadow-xs border-b ${
              theme === 'high-density'
                ? 'bg-[#F2F2F2] text-[#141414] border-[#141414]'
                : 'bg-slate-50 text-slate-900 border-slate-200'
            }`}>
              <div className="flex items-stretch h-11 text-[11px] font-bold">
                {/* 1. Checkbox: 44px */}
                <div className={`w-[44px] shrink-0 flex items-center justify-center border-r ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  <input 
                    type="checkbox" 
                    checked={pageItems.length > 0 && pageItems.every(i => selectedIds.has(i.id))}
                    onChange={() => toggleAll(pageItems)}
                    className={theme === 'high-density' ? 'accent-[#141414] cursor-pointer' : 'accent-indigo-600 cursor-pointer'}
                  />
                </div>

                {/* 2. No: 50px */}
                <div className={`w-[50px] shrink-0 flex items-center justify-center border-r uppercase tracking-tight ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  No.
                </div>

                {/* 3. Name: 230px */}
                <div className={`w-[230px] shrink-0 flex items-center justify-between px-2.5 border-r relative group ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  <span className="truncate font-black">품 명</span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFilterColumn(activeFilterColumn === 'name' ? null : 'name');
                    }}
                    className={`p-1 rounded hover:bg-slate-200/70 transition-colors ${columnFilters.name ? 'text-indigo-600 font-bold' : 'text-slate-400 group-hover:text-slate-600'}`}
                    title="품명 필터"
                  >
                    <Filter size={11} fill={columnFilters.name ? 'currentColor' : 'none'} />
                  </button>

                  {activeFilterColumn === 'name' && (
                    <>
                      <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                      <ColumnFilterDropdown 
                        columnId="name" 
                        value={columnFilters.name} 
                        onValueChange={(val) => setColumnFilters(prev => ({ ...prev, name: val }))}
                        onClose={() => setActiveFilterColumn(null)}
                        suggestions={uniqueNames}
                        filterOperator={filterOperator}
                        onOperatorChange={setFilterOperator}
                      />
                    </>
                  )}
                </div>

                {/* 4. Spec: 210px */}
                <div className={`w-[210px] shrink-0 flex items-center justify-between px-2 border-r relative group ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  <span className="truncate font-black">규 격</span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFilterColumn(activeFilterColumn === 'spec' ? null : 'spec');
                    }}
                    className={`p-1 rounded hover:bg-slate-200/70 transition-colors ${columnFilters.spec ? 'text-indigo-600 font-bold' : 'text-slate-400 group-hover:text-slate-600'}`}
                    title="규격 필터"
                  >
                    <Filter size={11} fill={columnFilters.spec ? 'currentColor' : 'none'} />
                  </button>

                  {activeFilterColumn === 'spec' && (
                    <>
                      <div className="fixed inset-0 z-[999] cursor-default" onClick={() => setActiveFilterColumn(null)} />
                      <ColumnFilterDropdown 
                        columnId="spec" 
                        value={columnFilters.spec} 
                        onValueChange={(val) => setColumnFilters(prev => ({ ...prev, spec: val }))}
                        onClose={() => setActiveFilterColumn(null)}
                        suggestions={uniqueSpecs}
                        filterOperator={filterOperator}
                        onOperatorChange={setFilterOperator}
                      />
                    </>
                  )}
                </div>

                {/* 5. Unit: 48px */}
                <div className={`w-[48px] shrink-0 flex items-center justify-center border-r uppercase tracking-tight ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  단위
                </div>

                {/* 6. Quantity: 68px */}
                <div className={`w-[68px] shrink-0 flex items-center justify-center border-r uppercase tracking-tight ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  수량
                </div>

                {/* 7 & 8. Material: 182px (84px + 98px) */}
                <div className={`w-[182px] shrink-0 flex flex-col border-r ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'} ${costViewType === 'material' ? 'bg-blue-600 text-white ring-2 ring-inset ring-blue-400 z-10' : ''}`}>
                  <div className={`h-1/2 flex items-center justify-center border-b font-black ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'material' ? 'border-blue-400' : 'border-slate-200')}`}>
                    재 료 비
                  </div>
                  <div className="h-1/2 flex text-[10px]">
                    <div className={`w-[84px] shrink-0 flex items-center justify-center border-r ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'material' ? 'border-blue-400' : 'border-slate-200')}`}>
                      단 가
                    </div>
                    <div className="w-[98px] shrink-0 flex items-center justify-center">
                      금 액
                    </div>
                  </div>
                </div>

                {/* 9 & 10. Labor: 182px (84px + 98px) */}
                <div className={`w-[182px] shrink-0 flex flex-col border-r ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'} ${costViewType === 'labor' ? 'bg-amber-600 text-white ring-2 ring-inset ring-amber-400 z-10' : ''}`}>
                  <div className={`h-1/2 flex items-center justify-center border-b font-black ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'labor' ? 'border-amber-400' : 'border-slate-200')}`}>
                    노 무 비
                  </div>
                  <div className="h-1/2 flex text-[10px]">
                    <div className={`w-[84px] shrink-0 flex items-center justify-center border-r ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'labor' ? 'border-amber-400' : 'border-slate-200')}`}>
                      단 가
                    </div>
                    <div className="w-[98px] shrink-0 flex items-center justify-center">
                      금 액
                    </div>
                  </div>
                </div>

                {/* 11 & 12. Total: 198px (88px + 110px) */}
                <div className={`w-[198px] shrink-0 flex flex-col border-r ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'} ${costViewType === 'total' ? 'bg-indigo-600 text-white ring-2 ring-inset ring-indigo-400 z-10' : ''}`}>
                  <div className={`h-1/2 flex items-center justify-center border-b font-black ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'total' ? 'border-indigo-400' : 'border-slate-200')}`}>
                    합 계
                  </div>
                  <div className="h-1/2 flex text-[10px]">
                    <div className={`w-[88px] shrink-0 flex items-center justify-center border-r ${theme === 'high-density' ? 'border-[#141414]' : (costViewType === 'total' ? 'border-indigo-400' : 'border-slate-200')}`}>
                      단 가
                    </div>
                    <div className={`w-[110px] shrink-0 flex items-center justify-center font-bold ${costViewType === 'total' ? 'text-amber-300' : 'text-indigo-600'}`}>
                      금 액
                    </div>
                  </div>
                </div>

                {/* 13. Remark: 104px */}
                <div className={`w-[104px] shrink-0 flex items-center px-2 border-r font-black ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  비 고
                </div>

                {/* 14. Memo: 130px */}
                <div className={`w-[130px] shrink-0 flex items-center px-2 border-r font-black ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  메 모
                </div>

                {/* 15. Execution Amount: 120px */}
                <div className={`w-[120px] shrink-0 flex items-center px-2 border-r font-black ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  실행금액
                </div>

                {/* 16. Comparison: 80px */}
                <div className={`w-[80px] shrink-0 flex items-center justify-center border-r font-black ${theme === 'high-density' ? 'border-[#141414]' : 'border-slate-200'}`}>
                  대 비
                </div>

                {/* 17. Category: 170px */}
                <div className="w-[170px] shrink-0 flex items-center justify-center font-black">
                  재료비 분류
                </div>
              </div>
            </div>

            {/* Virtualized Body */}
            {pageItems.length === 0 ? (
              <div className="py-24 text-center">
                <div className="max-w-md mx-auto">
                  {items.length === 0 ? (
                    <div className="flex flex-col gap-3">
                      {onOpenProcessCodes && (
                        <button
                          onClick={onOpenProcessCodes}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left ${processCodes && processCodes.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
                        >
                          <span className="flex items-center gap-2 text-sm font-bold">
                            <ListTree className="w-4 h-4" />
                            {processCodes && processCodes.length > 0
                              ? `① 공종표 등록됨 (${processCodes.length}개) — 수정하려면 클릭`
                              : '① 먼저 현장 공종표를 등록하세요 (현장명·대·중·소공종·세부단위)'}
                          </span>
                          <span className="text-xs opacity-70">{processCodes && processCodes.length > 0 ? '② 아래에 내역서 업로드' : '등록 없이 올리면 내역서 집계표로 자동 등록'}</span>
                        </button>
                      )}
                      <ExcelUpload onDataLoaded={onDataLoaded} variant="dropzone" processCodes={processCodes} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Filter className="w-12 h-12 opacity-20" />
                      <p>선택한 필터 조건에 맞는 항목이 없습니다.</p>
                      <button 
                        onClick={() => { setSectionFilter('all'); onCategoryFilterChange?.('all'); }}
                        className="text-indigo-600 font-medium hover:underline mt-2 cursor-pointer"
                      >
                        모든 필터 초기화
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <VirtualizedTableBody
                rows={virtualRows}
                height={Math.max(containerHeight - 95, 400)}
                theme={theme}
                density={density}
                costViewType={costViewType}
                selectedIds={selectedIds}
                toggleOne={toggleOne}
                toggleAll={toggleAll}
                handleMouseDown={handleMouseDown}
                handleMouseEnter={handleMouseEnter}
                renderRuleIndicator={renderRuleIndicator}
                categories={categories}
                categoryColors={categoryColors}
                onUpdateCategory={onUpdateCategory}
                onAddCategory={onAddCategory}
                onRevertCategory={onRevertCategory}
                onUpdateMemo={onUpdateMemo}
                onUpdateExecutionAmount={onUpdateExecutionAmount}
                editingId={editingId}
                editValue={editValue}
                startEditing={startEditing}
                saveEdit={saveEdit}
                handleKeyDown={handleKeyDown}
                setEditValue={setEditValue}
                getCellPadding={getCellPadding}
              />
            )}

            {/* Sticky Total Footer: 1616px matching columns */}
            {items.length > 0 && (
              <div className={`sticky bottom-0 z-20 flex items-center h-11 border-t-2 ${
                theme === 'high-density' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-slate-800 text-white border-slate-900'
              }`}>
                {/* Spans Checkbox to Total Unit Price: 44+50+230+210+48+68+84+98+84+98+88 = 1102px */}
                <div className="w-[1102px] shrink-0 px-4 flex items-center justify-between border-r border-white/10 overflow-hidden">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] opacity-60 truncate">
                    {costViewType === 'total' ? '내역 항목 전체 합계 (TOTAL BREAKDOWN)' : 
                     costViewType === 'material' ? '재료비 합계 (MATERIAL)' : 
                     '노무비 합계 (LABOR)'}
                  </div>

                  {costViewType === 'total' && (
                    <div className="flex gap-3 items-center">
                      <div className="flex flex-col items-end border-l border-white/10 pl-2">
                        <span className="text-[7px] text-slate-400 font-bold uppercase leading-none mb-0.5">재료(직접)</span>
                        <span className="text-blue-300 text-[10px] font-black leading-none">₩{costBreakdown.materialCost.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end border-l border-white/10 pl-2">
                        <span className="text-[7px] text-slate-400 font-bold uppercase leading-none mb-0.5">노무비</span>
                        <span className="text-amber-200 text-[10px] font-black leading-none">₩{costBreakdown.laborCost.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end border-l border-white/10 pl-2">
                        <span className="text-[7px] text-slate-400 font-bold uppercase leading-none mb-0.5">외주(일괄)</span>
                        <span className="text-indigo-300 text-[10px] font-black leading-none">₩{costBreakdown.outsourcingCost.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end border-l border-white/10 pl-2">
                        <span className="text-[7px] text-slate-400 font-bold uppercase leading-none mb-0.5">간접비</span>
                        <span className="text-orange-300 text-[10px] font-black leading-none">₩{costBreakdown.indirectCost.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end border-l border-white/10 pl-2">
                        <span className="text-[7px] text-slate-400 font-bold uppercase leading-none mb-0.5">지급자재</span>
                        <span className="text-emerald-400 text-[10px] font-black leading-none">₩{costBreakdown.clientSuppliedCost.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end border-l border-white/10 pl-2 bg-amber-400/15 px-1.5 py-0.5 rounded border border-amber-400/30">
                        <span className="text-[7px] text-amber-300 font-bold uppercase leading-none mb-0.5">[별도] 안전장비</span>
                        <span className="text-amber-200 text-[10px] font-black leading-none">₩{costBreakdown.safetyEquipmentCost.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Total Amount: 110px (안전장비류 제외된 총 도급/계약 금액) */}
                <div className={`w-[110px] shrink-0 px-2 text-right font-mono text-sm font-black border-r border-white/10 ${
                  costViewType === 'total' ? 'text-amber-300' : 
                  costViewType === 'material' ? 'text-blue-300' : 'text-amber-300'
                }`} title={costViewType === 'total' ? `총 계약 합계 (안전장비류 ₩${costBreakdown.safetyEquipmentCost.toLocaleString()} 제외)` : undefined}>
                  ₩{(
                    costViewType === 'total'
                      ? costBreakdown.totalContractAmount
                      : costViewType === 'material'
                        ? costBreakdown.materialCost
                        : costBreakdown.totalLaborAndOutsourcing
                  ).toLocaleString()}
                </div>

                {/* Page Sum info: 604px (104+130+120+80+170) */}
                <div className="w-[604px] shrink-0 px-4 text-xs text-slate-300 font-medium flex items-center justify-between truncate">
                  {costBreakdown.safetyEquipmentCost > 0 && (
                    <span className="text-amber-300 text-[11px] font-bold flex items-center gap-1">
                      <span>🛡️</span>
                      <span>[별도 표기] 안전장비류: ₩{costBreakdown.safetyEquipmentCost.toLocaleString()} (총 계약 합계 금액에서 제외됨)</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Navigation Bar removed per user request */}
      </div>
      {/* Smart Selection Helper Popup */}
      {selectionHelper && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[101] w-[340px] bg-white border border-indigo-200 rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.15)] p-4 flex flex-col gap-3 ring-4 ring-indigo-500/10"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 shrink-0">
              <Zap size={20} className="animate-pulse text-indigo-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-0.5">스마트 일괄 선택 제안</h4>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                현재 선택하신 <span className="text-indigo-600 font-bold">'{selectionHelper.name}'</span> 품명과 동일한 항목이 <span className="font-bold text-slate-800">{selectionHelper.count}개</span> 더 있습니다.
              </p>
            </div>
            <button 
              onClick={() => setSelectionHelper(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setSelectionHelper(null)}
              className="flex-1 py-2 text-[11px] font-black text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
            >
              취소
            </button>
            <button
              onClick={() => {
                const newSelected = new Set(selectedIds);
                selectionHelper.ids.forEach(id => newSelected.add(id));
                setSelectedIds(newSelected);
                setSelectionHelper(null);
              }}
              className="flex-[2.5] py-2 text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <span>동일 품명 {selectionHelper.count}개 일괄 선택</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {selectionSummary && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4 pointer-events-none"
        >
          <div className="bg-[#141414] text-white rounded-2xl shadow-2xl border border-white/10 p-4 flex items-center justify-between gap-6 backdrop-blur-md bg-opacity-95 pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Table className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase opacity-60">드래그 선택 합계 ({selectionSummary.count}개 항목)</span>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-indigo-300">재료비 소계</span>
                    <span className="text-sm font-black font-mono">₩{selectionSummary.material.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-amber-300">노무비 소계</span>
                    <span className="text-sm font-black font-mono">₩{selectionSummary.labor.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase opacity-60">선택 총 합계</span>
                <span className="text-xl font-black font-mono text-green-400">₩{selectionSummary.total.toLocaleString()}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(new Set());
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
                title="선택 해제"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {renderFooter()}

      {/* Category Suggestions Datalist */}
      <datalist id="category-suggestions">
        {categories.map(cat => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
  );
}
