import React, { useState, useMemo, useRef } from 'react';
import { SpecItem, ThemeType, SeparationMethod } from '../types';
import {
  Download,
  Printer,
  FileDown,
  Loader2,
  Search,
  Filter,
  Columns,
  Layers,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  Check,
  CheckSquare,
  Square,
  RotateCcw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { exportStyledExcel } from '../utils/excelExport';
import { exportMatrixToPDF } from '../utils/pdfExport';

import {
  getItemMaterialCost,
  getItemLaborCost,
  getItemQuantity,
  isOutsourcingCategory,
  isIndirectCostCategory,
  isClientSuppliedCategory
} from '../utils/costCalculation';
import { LEVEL_1_PROCESS_NAMES, LEVEL_2_PROCESS_NAMES, extractProcessCode, buildMatrixHeaderLookup, matrixHeaderFor } from '../utils/sectionHierarchy';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  categoryColors?: Record<string, string>;
  projectName?: string;
  onOpenCategoryManager?: () => void;
  separationMethod?: SeparationMethod;
}

interface MatrixItemRow {
  key: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalAmount: number;
  sectionQuantities: Record<string, number>;
}

interface MatrixCategoryGroup {
  category: string;
  items: MatrixItemRow[];
  subtotalQuantity: number;
  subtotalAmount: number;
  sectionSubtotals: Record<string, number>;
}

export default function CategoryMatrixView({
  items,
  theme,
  categories,
  projectName = '기계설비공사',
  onOpenCategoryManager,
  separationMethod = 'method2'
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPageGuides, setShowPageGuides] = useState(true);
  const [hideZeroQty, setHideZeroQty] = useState(true);
  const [autoHideEmptySectionCols, setAutoHideEmptySectionCols] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [isSectionFilterExpanded, setIsSectionFilterExpanded] = useState(true);
  const [sectionFilterSearch, setSectionFilterSearch] = useState('');
  const [hidePriceAndAmount, setHidePriceAndAmount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState('');
  const printContainerRef = useRef<HTMLDivElement>(null);

  // 1. Extract and normalize all unique sections (공종/구간)
  const allSections = useMemo(() => {
    const sectionSet = new Set<string>();
    items.forEach(item => {
      const sec = (item.section || '기타 공정').trim();
      if (sec) sectionSet.add(sec);
    });

    // If empty, supply default standard construction sections
    if (sectionSet.size === 0) {
      return [
        '옥외 (위생)',
        '기계실 (위생)',
        '세대내 급수급탕 (36m2)',
        '세대내 급수급탕 (45m2)',
        '세대내 급수급탕 (59m2)',
        '세대내 급수급탕 (84m2)',
        '세대외 (급수)',
        '주차장 (급수)',
        '주차장 (배수)',
        '근생 (급수급탕)',
        '부대시설 (급수급탕)'
      ];
    }

    return Array.from(sectionSet);
  }, [items]);

  // Overall Section statistics (Item count & Total quantity across raw items)
  const sectionStats = useMemo(() => {
    const map: Record<string, { itemCount: number; totalQty: number; totalAmt: number }> = {};
    allSections.forEach(s => {
      map[s] = { itemCount: 0, totalQty: 0, totalAmt: 0 };
    });

    items.forEach(item => {
      const sec = (item.section || '기타 공정').trim() || '기타 공정';
      const q = getItemQuantity(item);
      const p = item.materialUnitPrice || item.unitPrice || 0;
      if (!map[sec]) {
        map[sec] = { itemCount: 0, totalQty: 0, totalAmt: 0 };
      }
      map[sec].itemCount += 1;
      map[sec].totalQty += q;
      map[sec].totalAmt += item.amount || (q * p);
    });

    return map;
  }, [items, allSections]);

  // 2. Extract available categories with their item count and total quantity
  const availableCategories = useMemo(() => {
    const map = new Map<string, { count: number; totalQty: number }>();
    items.forEach(item => {
      const cat = (item.category || '미분류').trim() || '미분류';
      const qty = getItemQuantity(item);
      const cur = map.get(cat) || { count: 0, totalQty: 0 };
      cur.count += 1;
      cur.totalQty += qty;
      map.set(cat, cur);
    });

    const allKeys = Array.from(map.keys());
    const ordered = [
      ...categories.filter(c => allKeys.includes(c)),
      ...allKeys.filter(c => !categories.includes(c))
    ];

    return ordered.map(cat => ({
      name: cat,
      count: map.get(cat)?.count || 0,
      totalQty: map.get(cat)?.totalQty || 0
    }));
  }, [items, categories]);

  // 3. Aggregate data by (Category -> Name + Spec + Unit + UnitPrice)
  const groupedData = useMemo<MatrixCategoryGroup[]>(() => {
    if (!items || items.length === 0) return [];

    const categoryMap = new Map<string, Map<string, MatrixItemRow>>();

    const addMatrixEntry = (cat: string, name: string, spec: string, unit: string, quantity: number, amount: number, unitPrice: number, section: string, extraKey: string = '') => {
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, new Map<string, MatrixItemRow>());
      }

      const itemMap = categoryMap.get(cat)!;
      const itemKey = hidePriceAndAmount
        ? `${name}:::${spec}:::${unit}${extraKey}`
        : `${name}:::${spec}:::${unit}:::${unitPrice}${extraKey}`;

      if (!itemMap.has(itemKey)) {
        itemMap.set(itemKey, {
          key: itemKey,
          category: cat,
          name,
          specification: spec,
          unit,
          unitPrice,
          totalQuantity: 0,
          totalAmount: 0,
          sectionQuantities: {}
        });
      }

      const row = itemMap.get(itemKey)!;
      row.totalQuantity += quantity;
      row.totalAmount += amount;
      if (row.unitPrice === 0 && unitPrice > 0) {
        row.unitPrice = unitPrice;
      }
      row.sectionQuantities[section] = (row.sectionQuantities[section] || 0) + quantity;
    };

    items.forEach(item => {
      const itemCat = (item.category || '미분류').trim() || '미분류';
      const name = (item.name || '').trim();
      const spec = (item.specification || '').trim();
      const unit = (item.unit || 'EA').trim() || 'EA';
      const section = (item.section || '기타 공정').trim() || '기타 공정';
      const quantity = getItemQuantity(item);
      
      const matAmt = getItemMaterialCost(item, separationMethod);
      const labAmt = getItemLaborCost(item, separationMethod);

      const isSpecial = isIndirectCostCategory(itemCat) || isClientSuppliedCategory(itemCat);

      if (isSpecial) {
        // Everything stays in the special category
        const unitPrice = item.unitPrice || (quantity > 0 ? (matAmt + labAmt) / quantity : 0);
        addMatrixEntry(itemCat, name, spec, unit, quantity, matAmt + labAmt, unitPrice, section);
      } else {
        // Keep both in original category, but separate rows
        // 1. Material
        {
          const unitPrice = item.materialUnitPrice || (quantity > 0 ? matAmt / quantity : 0);
          addMatrixEntry(itemCat, name, spec, unit, quantity, matAmt, unitPrice, section);
        }
        
        // [노무비] 별도 행은 만들지 않음
      }
    });

    // Build Category Groups
    const result: MatrixCategoryGroup[] = [];

    // Ensure defined categories order first, then any extra
    const allCatKeys = Array.from(categoryMap.keys());
    const orderedCats = [
      ...categories.filter(c => allCatKeys.includes(c)),
      ...allCatKeys.filter(c => !categories.includes(c))
    ];

    orderedCats.forEach(cat => {
      const itemMap = categoryMap.get(cat);
      if (!itemMap || itemMap.size === 0) return;

      const rawItems = Array.from(itemMap.values());

      // Filter by search term and zero quantity
      const filteredItems = rawItems.filter(item => {
        // If hideZeroQty is ON, hide items where totalQuantity <= 0
        if (hideZeroQty && item.totalQuantity <= 0) return false;

        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.specification.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      });

      if (filteredItems.length === 0) return;

      // Calculate Subtotals for category
      let subtotalQty = 0;
      let subtotalAmt = 0;
      const sectionSubtotals: Record<string, number> = {};

      filteredItems.forEach(item => {
        subtotalQty += item.totalQuantity;
        subtotalAmt += item.totalAmount;
        Object.entries(item.sectionQuantities).forEach(([sec, q]) => {
          sectionSubtotals[sec] = (sectionSubtotals[sec] || 0) + Number(q || 0);
        });
      });

      // If hideZeroQty is ON, hide category if subtotal quantity <= 0
      if (hideZeroQty && subtotalQty <= 0) return;

      result.push({
        category: cat,
        items: filteredItems,
        subtotalQuantity: subtotalQty,
        subtotalAmount: subtotalAmt,
        sectionSubtotals
      });
    });

    // Filter by selected category dropdown
    if (selectedCategory !== 'all') {
      return result.filter(g => g.category === selectedCategory);
    }

    return result;
  }, [items, categories, searchTerm, selectedCategory, hideZeroQty, hidePriceAndAmount]);

  // 4. Calculate Grand Totals & Section Totals across current view
  const grandTotal = useMemo(() => {
    let totalQty = 0;
    let totalAmt = 0;
    const sectionTotals: Record<string, number> = {};

    groupedData.forEach(group => {
      totalQty += group.subtotalQuantity;
      totalAmt += group.subtotalAmount;
      Object.entries(group.sectionSubtotals).forEach(([sec, q]) => {
        sectionTotals[sec] = (sectionTotals[sec] || 0) + Number(q || 0);
      });
    });

    return {
      totalQty,
      totalAmt,
      sectionTotals
    };
  }, [groupedData]);

  // 5. Visible sections list based on hidden toggle & Zero Quantity Column Auto-Hide
  const visibleSections = useMemo(() => {
    return allSections.filter(sec => {
      // If user explicitly hid this section in picker
      if (hiddenSections[sec]) return false;

      // If auto-hide empty section columns is ON and total sum across active items is 0
      const totalQtyForSection = grandTotal.sectionTotals[sec] || 0;
      if (autoHideEmptySectionCols && totalQtyForSection <= 0) return false;

      return true;
    });
  }, [allSections, hiddenSections, autoHideEmptySectionCols, grandTotal.sectionTotals]);

  // 집계표 열 머리글: 현장 데이터의 실제 공종명 사용
  const headerLookup = useMemo(() => buildMatrixHeaderLookup(items), [items]);

  // 6. Parse section headers into 2-tier (대공종 / 세부구간)
  const parsedSections = useMemo(() => {
    return visibleSections.map(sec => {
      // Check if format contains separator like "기계설비 > 옥외 (위생)" or code like "010102 옥외배관공사"
      let mainGroup = '기계설비';
      let subGroup = sec;

      const parsed = extractProcessCode(sec);
      if (parsed) {
        const { code, rest } = parsed;
        subGroup = rest || sec;
        if (code.length === 10) {
          const l2Code = code.slice(0, 8);
          mainGroup = LEVEL_2_PROCESS_NAMES[l2Code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
          if (mainGroup && subGroup.includes(mainGroup)) {
            const stripped = subGroup.replace(mainGroup, '').trim();
            if (stripped) {
              subGroup = stripped;
            }
          }
        } else if (code.length === 8) {
          mainGroup = LEVEL_2_PROCESS_NAMES[code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
          if (mainGroup && subGroup.includes(mainGroup)) {
            const stripped = subGroup.replace(mainGroup, '').trim();
            subGroup = stripped || LEVEL_2_PROCESS_NAMES[code]?.name || mainGroup;
          }
        } else if (code.length === 6) {
          mainGroup = LEVEL_1_PROCESS_NAMES[code] || '기계설비';
          subGroup = mainGroup;
        }
      } else if (sec.includes('>')) {
        const parts = sec.split('>');
        mainGroup = parts[0].trim();
        subGroup = parts.slice(1).join('>').trim();
      } else if (sec.includes(':')) {
        const parts = sec.split(':');
        mainGroup = parts[0].trim();
        subGroup = parts.slice(1).join(':').trim();
      } else if (/^\d+/.test(sec)) {
        // Strip leading numbers like "010102 옥외배관공사" -> main: "기계설비", sub: "옥외배관공사"
        subGroup = sec.replace(/^\d+[\s._-]*/, '').trim() || sec;
      }

      const dynHeader = matrixHeaderFor(sec, headerLookup);
      if (dynHeader) { mainGroup = dynHeader.mainGroup; subGroup = dynHeader.subGroup; }

      return {
        raw: sec,
        mainGroup,
        subGroup
      };
    });
  }, [visibleSections]);

  // Quick helpers for Section Selection
  const handleSelectAllSections = () => {
    setHiddenSections({});
    setAutoHideEmptySectionCols(false);
  };

  const handleDeselectAllSections = () => {
    const next: Record<string, boolean> = {};
    allSections.forEach(s => {
      next[s] = true;
    });
    setHiddenSections(next);
  };

  const handleSelectOnlyWithQty = () => {
    const next: Record<string, boolean> = {};
    allSections.forEach(s => {
      const qty = grandTotal.sectionTotals[s] ?? sectionStats[s]?.totalQty ?? 0;
      if (qty <= 0) {
        next[s] = true;
      }
    });
    setHiddenSections(next);
    setAutoHideEmptySectionCols(false);
  };

  const handleInvertSections = () => {
    const next: Record<string, boolean> = {};
    allSections.forEach(s => {
      const totalQty = grandTotal.sectionTotals[s] || 0;
      const isAutoHidden = autoHideEmptySectionCols && totalQty <= 0;
      const isCurrentlyVisible = !hiddenSections[s] && !isAutoHidden;
      next[s] = isCurrentlyVisible;
    });
    setHiddenSections(next);
    setAutoHideEmptySectionCols(false);
  };

  const toggleSingleSection = (sec: string) => {
    const totalQty = grandTotal.sectionTotals[sec] || 0;
    const isAutoHidden = autoHideEmptySectionCols && totalQty <= 0;
    const isChecked = !hiddenSections[sec] && !isAutoHidden;

    if (isAutoHidden) {
      setAutoHideEmptySectionCols(false);
      setHiddenSections(prev => {
        const copy = { ...prev };
        delete copy[sec];
        return copy;
      });
    } else {
      setHiddenSections(prev => ({
        ...prev,
        [sec]: isChecked
      }));
    }
  };

  const filteredSectionsForFilter = useMemo(() => {
    if (!sectionFilterSearch.trim()) return allSections;
    const q = sectionFilterSearch.toLowerCase();
    return allSections.filter(s => s.toLowerCase().includes(q));
  }, [allSections, sectionFilterSearch]);

  // Total items count across groups
  const totalItemCount = useMemo(() => {
    return groupedData.reduce((sum: number, g: MatrixCategoryGroup) => sum + g.items.length, 0);
  }, [groupedData]);

  // Toggle Collapse Category
  const toggleCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groupedData.forEach(g => {
      next[g.category] = true;
    });
    setCollapsedCategories(next);
  };

  const expandAll = () => {
    setCollapsedCategories({});
  };

  // Direct Excel Download handler
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportStyledExcel({
        projectName: projectName || '기계설비_공정분리',
        items,
        categories,
        hidePriceAndAmount,
        autoHideEmptySectionCols
      });
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Export handler
  const handleExportPDF = async () => {
    if (!printContainerRef.current) return;
    try {
      setIsExportingPDF(true);
      setPdfProgressText('PDF 서식 구성 중...');
      await exportMatrixToPDF({
        element: printContainerRef.current,
        filename: `${projectName || '기계설비'}_공정구간별_집계표`,
        projectName: projectName || '기계설비 공정분리 현장',
        categoryCount: groupedData.length,
        itemCount: totalItemCount,
        totalQty: grandTotal.totalQty,
        totalAmt: grandTotal.totalAmt,
        hidePriceAndAmount,
        onProgress: (status) => setPdfProgressText(status)
      });
    } catch (err) {
      console.error('PDF Export failed', err);
    } finally {
      setIsExportingPDF(false);
      setPdfProgressText('');
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  const isHighDensity = theme === 'high-density';

  return (
    <div className="flex flex-col flex-grow w-full space-y-4 font-sans print:p-0 print:m-0">
      {/* Top Action & Control Bar */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isHighDensity
            ? 'bg-[#E6EAF0] border-[#0a1220] text-black shadow-sm'
            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        } print:hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Info Badge */}
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isHighDensity
                  ? 'bg-[#0a1220] text-white'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  카테고리별 공정·구간별 집계표 (Matrix 양식)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  도면 내역 표준 서식
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                현장명: <strong>{projectName}</strong> | 총 {groupedData.length}개 카테고리 / {totalItemCount.toLocaleString()}개 규격 집계 | 총 공사비: <strong>₩{grandTotal.totalAmt.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Zero Quantity Items Hide/Show Toggle */}
            <button
              type="button"
              onClick={() => setHideZeroQty(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                hideZeroQty
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="수량이 0인 품목 및 카테고리를 표에서 숨김/표시"
            >
              <Filter size={14} />
              <span>수량 0 품목 숨김 {hideZeroQty ? 'ON' : 'OFF'}</span>
            </button>

            {/* Zero Quantity Section Column Auto-Hide Toggle */}
            <button
              type="button"
              onClick={() => setAutoHideEmptySectionCols(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                autoHideEmptySectionCols
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="수량이 없는 공정(구간) 열을 표 및 엑셀 시트에서 자동으로 숨기거나 표시합니다. (클릭하여 전환)"
            >
              <Columns size={14} />
              <span>수량 0 공정 자동숨김 {autoHideEmptySectionCols ? 'ON' : 'OFF'}</span>
            </button>

            {/* Hide Price and Amount Toggle - Highly Visible Accent Button */}
            <button
              type="button"
              onClick={() => setHidePriceAndAmount(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer shadow-xs ${
                hidePriceAndAmount
                  ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 ring-2 ring-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
              }`}
              title="내역물량 영역의 '단가' 및 '금액' 열을 숨기거나 표시합니다. (클릭하여 전환)"
            >
              {hidePriceAndAmount ? <EyeOff size={14} className="text-white" /> : <Eye size={14} className="text-amber-800" />}
              <span>{hidePriceAndAmount ? '단가·금액 숨김 (적용중)' : '단가·금액 숨기기'}</span>
            </button>

            {/* Page Guide Toggle */}
            <button
              type="button"
              onClick={() => setShowPageGuides(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showPageGuides
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="A4/A3 인쇄용 페이지 구분선 및 워터마크 표시"
            >
              {showPageGuides ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>페이지 가이드 {showPageGuides ? 'ON' : 'OFF'}</span>
            </button>

            {/* Section Column Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSectionFilterExpanded(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isSectionFilterExpanded
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="상단 공정·구간(Section) 선택 체크박스 그룹 열기/닫기"
            >
              <SlidersHorizontal size={14} />
              <span>구간 필터 ({visibleSections.length}/{allSections.length})</span>
              {isSectionFilterExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* PDF Export Button */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="현재 대시보드 상태의 집계표를 서식과 요약 정보가 포함된 고화질 PDF 보고서 파일로 즉시 저장합니다."
            >
              {isExportingPDF ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>{pdfProgressText || 'PDF 생성 중...'}</span>
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  <span>PDF로 저장하기</span>
                </>
              )}
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all cursor-pointer"
            >
              <Printer size={14} />
              <span>인쇄 / 인쇄미리보기</span>
            </button>

            {/* Excel Download Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? '엑셀 생성 중...' : '엑셀 다운로드 (서식 포함)'}</span>
            </button>
          </div>
        </div>

        {/* Section (공정·구간) Filtering Checkbox Group Panel */}
        <div className="mt-3 pt-3 border-t border-slate-200/80">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
            {/* Title, Badge & Expand/Collapse Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSectionFilterExpanded(prev => !prev)}
                className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 hover:text-indigo-600 cursor-pointer transition-colors"
              >
                <SlidersHorizontal size={15} className="text-indigo-600" />
                <span>공정·구간 (Section) 표시 필터</span>
                {isSectionFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border transition-colors ${
                visibleSections.length > 0
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                선택: {visibleSections.length} / {allSections.length}개 구간
              </span>
              {visibleSections.length > 0 && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  (구간 가로 폭: {visibleSections.length * 80}px)
                </span>
              )}
            </div>

            {/* Quick Action Buttons & Search */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Section Search in filter */}
              {allSections.length > 4 && isSectionFilterExpanded && (
                <div className="relative min-w-[140px] max-w-[190px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={sectionFilterSearch}
                    onChange={e => setSectionFilterSearch(e.target.value)}
                    placeholder="구간 검색..."
                    className="w-full pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  {sectionFilterSearch && (
                    <button
                      type="button"
                      onClick={() => setSectionFilterSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Quick Select All */}
              <button
                type="button"
                onClick={handleSelectAllSections}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                title="모든 공정·구간 열 표시"
              >
                <CheckSquare size={13} />
                <span>전체 선택</span>
              </button>

              {/* Quick Deselect All */}
              <button
                type="button"
                onClick={handleDeselectAllSections}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                title="모든 공정·구간 열 숨김 (품목 기본 정보만 보기)"
              >
                <Square size={13} />
                <span>전체 해제</span>
              </button>

              {/* Only Sections With Quantity */}
              <button
                type="button"
                onClick={handleSelectOnlyWithQty}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                title="물량이 1 이상 집계된 구간만 선택"
              >
                <Sparkles size={13} />
                <span>수량 있는 구간만</span>
              </button>

              {/* Invert Selection */}
              <button
                type="button"
                onClick={handleInvertSections}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                title="선택된 구간과 숨겨진 구간 반전"
              >
                <RotateCcw size={12} />
                <span>반전</span>
              </button>
            </div>
          </div>

          {/* Interactive Checkbox Chips Grid */}
          {isSectionFilterExpanded && (
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 transition-all">
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredSectionsForFilter.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 px-1">
                    검색어와 일치하는 공정·구간이 없습니다.
                  </div>
                ) : (
                  filteredSectionsForFilter.map(sec => {
                    const totalQty = grandTotal.sectionTotals[sec] || 0;
                    const isAutoHidden = autoHideEmptySectionCols && totalQty <= 0;
                    const isChecked = !hiddenSections[sec] && !isAutoHidden;

                    return (
                      <button
                        key={`chip-${sec}`}
                        type="button"
                        onClick={() => toggleSingleSection(sec)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs border transition-all cursor-pointer select-none text-left ${
                          isChecked
                            ? 'bg-white border-indigo-400 text-indigo-950 font-bold shadow-xs ring-2 ring-indigo-400/20'
                            : 'bg-white/60 border-slate-200 text-slate-400 hover:bg-white hover:text-slate-600 opacity-70'
                        }`}
                        title={sec}
                      >
                        {/* Custom Styled Checkbox Indicator */}
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-300 bg-slate-100'
                          }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>

                        {/* Section Name */}
                        <span className="truncate max-w-[180px] leading-tight text-[11px]">
                          {sec}
                        </span>

                        {/* Quantity Badge */}
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
                            totalQty > 0
                              ? isChecked
                                ? 'bg-indigo-100 text-indigo-800 font-extrabold'
                                : 'bg-slate-200 text-slate-600 font-semibold'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {totalQty > 0 ? `${totalQty.toLocaleString()}` : '0'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Sub helper notes */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span>💡 구간 칩을 클릭하여 매트릭스 열을 즉시 켜고 끌 수 있습니다.</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-semibold hover:text-slate-800">
                    <input
                      type="checkbox"
                      checked={autoHideEmptySectionCols}
                      onChange={e => setAutoHideEmptySectionCols(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>수량 0 공정 자동 숨김 (표·엑셀 연동)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-amber-800 font-bold hover:text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <input
                      type="checkbox"
                      checked={hidePriceAndAmount}
                      onChange={e => setHidePriceAndAmount(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                    />
                    <span>내역 단가 및 금액 숨기기</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search input */}
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="품명, 규격, 카테고리 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category dropdown filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">카테고리:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 text-slate-700 cursor-pointer"
              >
                <option value="all">전체 카테고리 ({groupedData.length}개 표시)</option>
                {availableCategories
                  .filter(cat => (!hideZeroQty || cat.totalQty > 0))
                  .map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} {cat.totalQty > 0 ? `(${cat.totalQty.toLocaleString()} EA)` : '(수량 0)'}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              모두 펼치기
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              모두 접기
            </button>
          </div>
        </div>
      </div>

      {/* Main Matrix Table Container */}
      <div
        ref={printContainerRef}
        data-pdf-container="true"
        className={`relative overflow-x-auto rounded-2xl border shadow-md ${
          isHighDensity
            ? 'bg-white border-[#0a1220]'
            : 'bg-white border-slate-300'
        } print:border-none print:shadow-none print:rounded-none`}
      >
        {/* Printable Report Header for Browser Print / PDF */}
        <div className="hidden print:block p-4 mb-3 border-b-2 border-slate-900 bg-white">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                [ {projectName} ] 카테고리별 공정·구간별 집계표 (Matrix 보고서)
              </h1>
              <p className="text-xs font-bold text-slate-600 mt-1">도면 내역 표준 서식 (Category & Section Breakdown)</p>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <div>출력 일시: {new Date().toLocaleDateString('ko-KR')} {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="font-bold text-slate-700 mt-0.5">기계설비 공정분리 자동화 시스템</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-800 bg-slate-100 p-2.5 rounded border border-slate-300">
            <div>집계: <strong>{groupedData.length}개 카테고리 / {totalItemCount.toLocaleString()}개 규격</strong></div>
            <span className="text-slate-400">|</span>
            <div>총 내역수량: <strong className="text-indigo-800 font-mono">{grandTotal.totalQty.toLocaleString()}</strong></div>
            {!hidePriceAndAmount && (
              <>
                <span className="text-slate-400">|</span>
                <div>총 공사비(금액): <strong className="text-indigo-950 font-mono">₩{grandTotal.totalAmt.toLocaleString()}</strong></div>
              </>
            )}
            {hidePriceAndAmount && (
              <>
                <span className="text-slate-400">|</span>
                <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-200">[단가 및 금액 열 숨김 모드]</span>
              </>
            )}
          </div>
        </div>

        <table
          className="table-fixed border-collapse text-[11px] text-slate-800 leading-tight"
          style={{
            width: `${Math.max(200 + 120 + 48 + 76 + (hidePriceAndAmount ? 0 : 84 + 100) + parsedSections.length * 80, hidePriceAndAmount ? 444 : 628)}px`,
            minWidth: '100%'
          }}
        >
          {/* Explicit Fixed Column Width Definitions */}
          <colgroup>
            {/* 1. 품 명: 200px */}
            <col style={{ width: '200px', minWidth: '200px' }} />
            {/* 2. 규 격: 120px */}
            <col style={{ width: '120px', minWidth: '120px' }} />
            {/* 3. 단위: 48px */}
            <col style={{ width: '48px', minWidth: '48px' }} />
            {/* 4. 수량(M): 76px */}
            <col style={{ width: '76px', minWidth: '76px' }} />
            {/* 5. 단가: 84px */}
            {!hidePriceAndAmount && <col style={{ width: '84px', minWidth: '84px' }} />}
            {/* 6. 금액: 100px */}
            {!hidePriceAndAmount && <col style={{ width: '100px', minWidth: '100px' }} />}
            {/* 7+. 각 공정/구간 열: 고정 80px */}
            {parsedSections.map((sec, idx) => (
              <col key={`col-sec-${idx}`} style={{ width: '80px', minWidth: '80px' }} />
            ))}
          </colgroup>

          {/* Table Header: 2-Tier Header matching the construction sheet */}
          <thead className="sticky top-0 z-30 bg-slate-100 text-slate-900 select-none shadow-xs">
            {/* Top Tier Header */}
            <tr className="border-b border-slate-400 bg-[#E2E8F0] font-bold text-center">
              <th
                rowSpan={2}
                className="w-[200px] border-r border-slate-300 px-3 py-2 text-left"
              >
                품 명
              </th>
              <th
                rowSpan={2}
                className="w-[120px] border-r border-slate-300 px-2 py-2 text-center"
              >
                규 격
              </th>
              <th
                rowSpan={2}
                className="w-[48px] border-r border-slate-300 px-1 py-2 text-center"
              >
                단위
              </th>
              {/* 내역물량 Spanning Header (76px or 260px) */}
              {hidePriceAndAmount ? (
                <th
                  rowSpan={2}
                  onClick={() => setHidePriceAndAmount(false)}
                  className="w-[76px] border-r-2 border-slate-400 px-2 py-2 text-right bg-[#CBD5E1] text-slate-900 font-extrabold cursor-pointer hover:bg-slate-300 group"
                  title="클릭 시 단가/금액 열 다시 표시"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>수량(M)</span>
                    <Eye size={12} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
                  </div>
                </th>
              ) : (
                <th
                  colSpan={3}
                  onClick={() => setHidePriceAndAmount(true)}
                  className="w-[260px] border-r-2 border-slate-400 px-3 py-1.5 text-center bg-[#CBD5E1] text-slate-900 font-extrabold cursor-pointer hover:bg-slate-300 group"
                  title="클릭 시 단가/금액 열 숨기기"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>내역물량</span>
                    <EyeOff size={13} className="text-slate-500 group-hover:text-slate-900 transition-colors" />
                  </div>
                </th>
              )}
              {/* Section Matrix 2-Tier Headers */}
              {parsedSections.map((sec, idx) => (
                <th
                  key={`top-sec-${idx}`}
                  className="w-[80px] border-r border-slate-300 px-1 py-1.5 text-center bg-[#E2E8F0] text-[10px] truncate"
                  title={sec.raw}
                >
                  <span className="truncate block">{sec.mainGroup}</span>
                </th>
              ))}
            </tr>

            {/* Bottom Tier Header */}
            <tr className="border-b-2 border-slate-400 bg-[#F1F5F9] font-bold text-center text-[10px]">
              {/* Sub-headers for 내역물량 only rendered when hidePriceAndAmount is FALSE */}
              {!hidePriceAndAmount && (
                <>
                  <th className="w-[76px] border-r border-slate-300 px-2 py-1 text-right bg-[#F1F5F9] truncate">
                    수량(M)
                  </th>
                  <th className="w-[84px] border-r border-slate-300 px-2 py-1 text-right bg-[#F1F5F9] truncate">
                    단가
                  </th>
                  <th className="w-[100px] border-r-2 border-slate-400 px-2 py-1 text-right bg-[#E2E8F0] text-indigo-950 font-extrabold truncate">
                    금액
                  </th>
                </>
              )}
              {/* Sub-headers for sections (e.g. 옥외 위생, 기계실, etc.) */}
              {parsedSections.map((sec, idx) => (
                <th
                  key={`sub-sec-${idx}`}
                  className="w-[80px] border-r border-slate-300 px-1 py-1 text-center font-semibold text-slate-700 text-[10px] truncate leading-tight bg-[#F8FAFC]"
                  title={sec.raw}
                >
                  <span className="truncate block">{sec.subGroup}</span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body: Grouped by Category */}
          <tbody>
            {groupedData.length === 0 ? (
              <tr>
                <td
                  colSpan={(hidePriceAndAmount ? 4 : 6) + visibleSections.length}
                  className="py-16 text-center text-slate-400"
                >
                  <Info size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-sm">표시할 집계 데이터가 없습니다.</p>
                  <p className="text-xs mt-1">상단에서 내역서를 업로드하거나 검색 필터를 조정해 보세요.</p>
                </td>
              </tr>
            ) : (
              groupedData.map((group, groupIdx) => {
                const isCollapsed = collapsedCategories[group.category];
                return (
                  <React.Fragment key={`cat-group-${group.category}`}>
                    {/* Category Header Banner if needed or directly items */}
                    {!isCollapsed &&
                      group.items.map((item, itemIdx) => {
                        // Check if previous item had the same name for optical grouping
                        const prevItem = itemIdx > 0 ? group.items[itemIdx - 1] : null;
                        const isSameNameAsPrev = prevItem && prevItem.name === item.name;

                        return (
                          <tr
                            key={`item-${item.key}-${itemIdx}`}
                            className={`border-b border-slate-200 transition-colors hover:bg-amber-50/40 ${
                              itemIdx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                            }`}
                          >
                            {/* 품 명 */}
                            <td
                              className={`w-[200px] border-r border-slate-300 px-3 py-1.5 text-left truncate font-medium text-slate-900 ${
                                isSameNameAsPrev ? 'text-slate-400 pl-5 text-[10px]' : 'font-bold'
                              }`}
                              title={item.name}
                            >
                              <span className="truncate block">{item.name || '-'}</span>
                            </td>

                            {/* 규 격 */}
                            <td className="w-[120px] border-r border-slate-300 px-1.5 py-1.5 text-center font-mono text-slate-700 truncate" title={item.specification}>
                              <span className="truncate block">{item.specification || '-'}</span>
                            </td>

                            {/* 단 위 */}
                            <td className="w-[48px] border-r border-slate-300 px-1 py-1.5 text-center text-slate-500 truncate">
                              <span className="truncate block">{item.unit || 'EA'}</span>
                            </td>

                            {/* 수량(M) */}
                            <td className={`w-[76px] ${hidePriceAndAmount ? 'border-r-2 border-slate-400 font-black text-indigo-950 bg-slate-50/30' : 'border-r border-slate-300 font-bold text-slate-900'} px-2 py-1.5 text-right font-mono truncate`}>
                              {item.totalQuantity > 0 ? item.totalQuantity.toLocaleString() : '-'}
                            </td>

                            {/* 단가 및 금액 */}
                            {!hidePriceAndAmount && (
                              <>
                                <td className="w-[84px] border-r border-slate-300 px-2 py-1.5 text-right font-mono text-slate-600 truncate">
                                  {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : '-'}
                                </td>
                                <td className="w-[100px] border-r-2 border-slate-400 px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-50/60 truncate">
                                  {item.totalAmount > 0 ? item.totalAmount.toLocaleString() : '-'}
                                </td>
                              </>
                            )}

                            {/* Section Quantities */}
                            {parsedSections.map((sec, sIdx) => {
                              const q = item.sectionQuantities[sec.raw] || 0;
                              return (
                                <td
                                  key={`val-${item.key}-${sIdx}`}
                                  className={`w-[80px] border-r border-slate-300 px-1 py-1.5 text-center font-mono text-xs truncate ${
                                    q > 0
                                      ? 'text-slate-900 font-semibold bg-amber-50/20'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {q > 0 ? q.toLocaleString() : ''}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                    {/* Category Subtotal Row (소계) - Golden / Earthy Olive highlight as shown in user's image */}
                    <tr
                      onClick={() => toggleCollapse(group.category)}
                      className="border-b-2 border-slate-400 bg-[#D4C287] hover:bg-[#C9B678] text-slate-950 font-bold select-none cursor-pointer transition-colors"
                      title="클릭하여 이 카테고리 접기/펼치기"
                    >
                      {/* Col 1: Category Name */}
                      <td className="w-[200px] border-r border-slate-400/80 px-3 py-2 text-left truncate">
                        <div className="flex items-center justify-between truncate">
                          <span className="font-extrabold tracking-wide truncate">{group.category}</span>
                          <span className="text-[10px] opacity-70 ml-1 shrink-0">
                            {isCollapsed ? `[접힘 - ${group.items.length}개]` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Col 2: Representative Unit (EA) */}
                      <td className="w-[120px] border-r border-slate-400/80 px-1 py-2 text-center truncate">
                        EA
                      </td>

                      {/* Col 3: '소계' Label */}
                      <td className="w-[48px] border-r border-slate-400/80 px-1 py-2 text-center font-extrabold text-[11px] truncate">
                        소계
                      </td>

                      {/* Col 4: Subtotal Quantity */}
                      <td className={`w-[76px] ${hidePriceAndAmount ? 'border-r-2 border-slate-500' : 'border-r border-slate-400/80'} px-2 py-2 text-right font-mono font-extrabold truncate`}>
                        {group.subtotalQuantity > 0 ? group.subtotalQuantity.toLocaleString() : '-'}
                      </td>

                      {/* Col 5 & 6: Unit Price Placeholder & Subtotal Total Amount */}
                      {!hidePriceAndAmount && (
                        <>
                          <td className="w-[84px] border-r border-slate-400/80 px-1 py-2 text-center text-slate-600 truncate">
                            -
                          </td>
                          <td className="w-[100px] border-r-2 border-slate-500 px-2 py-2 text-right font-mono font-black text-slate-950 truncate">
                            {group.subtotalAmount.toLocaleString()}
                          </td>
                        </>
                      )}

                      {/* Section Subtotal Quantities */}
                      {parsedSections.map((sec, sIdx) => {
                        const secSubtotal = group.sectionSubtotals[sec.raw] || 0;
                        return (
                          <td
                            key={`cat-sub-${group.category}-${sIdx}`}
                            className="w-[80px] border-r border-slate-400/80 px-1 py-2 text-center font-mono font-bold text-slate-900 truncate"
                          >
                            {secSubtotal > 0 ? secSubtotal.toLocaleString() : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })
            )}

            {/* Page Guide Marker (Multi-page watermark like shown in user image) */}
            {showPageGuides && groupedData.length > 0 && (
              <tr className="bg-slate-100 border-y border-dashed border-indigo-300 print:hidden select-none">
                <td
                  colSpan={(hidePriceAndAmount ? 4 : 6) + visibleSections.length}
                  className="py-1 text-center font-bold text-[10px] text-indigo-600 tracking-widest bg-indigo-50/70"
                >
                  --- 인쇄 페이지 구분 기준 영역 (A4 / A3 가로 양식 매트릭스) ---
                </td>
              </tr>
            )}

            {/* Grand Total Row (합 계) - Highlighted in distinct light green/blue band */}
            {groupedData.length > 0 && (
              <tr className="border-t-2 border-b-2 border-slate-600 bg-[#CFE2F3] text-slate-950 font-black text-xs select-none">
                {/* Merged Title: 합 계 (200 + 120 + 48 = 368px) */}
                <td
                  colSpan={3}
                  className="w-[368px] border-r border-slate-400 px-4 py-2.5 text-center tracking-widest text-sm font-black truncate"
                >
                  합 계 (GRAND TOTAL)
                </td>

                {/* Grand Total Quantity */}
                <td className={`w-[76px] ${hidePriceAndAmount ? 'border-r-2 border-slate-500 font-black' : 'border-r border-slate-400'} px-2 py-2.5 text-right font-mono font-black text-sm truncate`}>
                  {grandTotal.totalQty.toLocaleString()}
                </td>

                {/* Col 5 & 6: Blank Unit Price & Grand Total Amount */}
                {!hidePriceAndAmount && (
                  <>
                    <td className="w-[84px] border-r border-slate-400 px-1 py-2.5 text-center text-slate-500 truncate">
                      -
                    </td>
                    <td className="w-[100px] border-r-2 border-slate-500 px-2 py-2.5 text-right font-mono font-black text-sm text-indigo-950 bg-[#B8D5E5] truncate">
                      ₩{grandTotal.totalAmt.toLocaleString()}
                    </td>
                  </>
                )}

                {/* Grand Total Quantities per Section */}
                {parsedSections.map((sec, sIdx) => {
                  const totalSecQ = grandTotal.sectionTotals[sec.raw] || 0;
                  return (
                    <td
                      key={`grand-sec-${sIdx}`}
                      className="w-[80px] border-r border-slate-400 px-1 py-2.5 text-center font-mono font-black text-slate-950 truncate"
                    >
                      {totalSecQ > 0 ? totalSecQ.toLocaleString() : '-'}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Notes & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 px-1 print:hidden">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-500" />
          <span>
            카테고리 소계 행(금색)을 클릭하면 해당 항목들을 접거나 펼칠 수 있으며, <strong>[엑셀 다운로드]</strong> 시 동일한 구간별 수량 매트릭스가 엑셀 시트에 그대로 보존됩니다.
          </span>
        </div>
        <div>
          <span>출력 일자: {new Date().toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </div>
  );
}
