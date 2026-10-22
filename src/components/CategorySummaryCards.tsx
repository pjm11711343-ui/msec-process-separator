import React from 'react';
import { SpecItem, ThemeType, SeparationMethod } from '../types';
import { motion } from 'motion/react';
import { Tags, TrendingUp, PieChart as PieChartIcon, Building2, Package, Wrench, ShieldCheck, AlertCircle, ArrowUpRight, Calculator, BarChart3, Edit2, Check, X, Workflow } from 'lucide-react';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  getItemContractAmount, 
  calculateCostBreakdown,
  isOutsourcingCategory, 
  isIndirectCostCategory, 
  isClientSuppliedCategory, 
  isExcludedFromMaterialCost,
  isSafetyEquipmentItem,
  isSafetyEquipmentCategory
} from '../utils/costCalculation';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  categories: string[];
  categoryColors?: Record<string, string>;
  projectName?: string;
  isProjectLocked?: boolean;
  categoryEstimates?: Record<string, number>;
  separationMethod?: SeparationMethod;
  onUpdateSeparationMethod?: (method: SeparationMethod) => void;
  onCategoryClick?: (category: string) => void;
  onOpenStats?: () => void;
  onUpdateSafetyAmount?: (amount: number) => void;
  onUpdateCategoryEstimate?: (category: string, amount: number) => void;
  onRenameCategory?: (oldCategory: string, newCategory: string) => void;
}

export default function CategorySummaryCards({
  items,
  theme,
  categories,
  categoryColors = {},
  projectName,
  isProjectLocked,
  categoryEstimates = {},
  separationMethod = 'method2',
  onUpdateSeparationMethod,
  onCategoryClick,
  onOpenStats,
  onUpdateSafetyAmount,
  onUpdateCategoryEstimate,
  onRenameCategory
}: Props) {
  const [isEditingSafety, setIsEditingSafety] = React.useState(false);
  const [safetyInputVal, setSafetyInputVal] = React.useState('');
  const [showComparison, setShowComparison] = React.useState(false);
  const [editingEstimate, setEditingEstimate] = React.useState<string | null>(null);
  const [estimateInput, setEstimateInput] = React.useState('');

  // Manual category name editing states
  const [editingCategoryName, setEditingCategoryName] = React.useState<string | null>(null);
  const [categoryNameInput, setCategoryNameInput] = React.useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = React.useState(false);
  const [modalSelectedCategory, setModalSelectedCategory] = React.useState('');
  const [modalNewCategoryName, setModalNewCategoryName] = React.useState('');

  const handleStartRename = (catName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCategoryName(catName);
    setCategoryNameInput(catName);
  };

  const handleSaveRename = (catName: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const trimmed = categoryNameInput.trim();
    if (trimmed && trimmed !== catName) {
      onRenameCategory?.(catName, trimmed);
    }
    setEditingCategoryName(null);
    setCategoryNameInput('');
  };

  const handleCancelRename = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setEditingCategoryName(null);
    setCategoryNameInput('');
  };

  const openRenameModal = (targetCategory?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const initialCat = targetCategory || '';
    setModalSelectedCategory(initialCat);
    setModalNewCategoryName(initialCat);
    setIsRenameModalOpen(true);
  };

  const handleApplyModalRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!modalSelectedCategory || !modalNewCategoryName.trim()) return;
    if (modalNewCategoryName.trim() !== modalSelectedCategory) {
      onRenameCategory?.(modalSelectedCategory, modalNewCategoryName.trim());
    }
    setIsRenameModalOpen(false);
  };

  if (items.length === 0) return null;

  // 1. Precise breakdown of Material Cost vs Labor/Outsourcing Cost for each item
  const getItemMaterialAmount = (item: SpecItem): number => {
    return getItemMaterialCost(item, separationMethod);
  };

  const getItemLaborAmount = (item: SpecItem): number => {
    return getItemLaborCost(item, separationMethod);
  };

  const getItemCategoryAmount = (item: SpecItem): number => {
    return getItemContractAmount(item, separationMethod);
  };

  // 안전장비류 제외 총 계약 합계 및 원가 구성 산출 (단일 진실 공급원)
  const costBreakdown = calculateCostBreakdown(items, separationMethod);
  const totalContractAmount = costBreakdown.totalContractAmount;
  const totalMaterialAmount = costBreakdown.materialCost;
  const totalLaborAmount = costBreakdown.totalLaborAndOutsourcing;
  const safetyEquipmentAmount = costBreakdown.safetyEquipmentCost;

  const materialPercent = totalContractAmount > 0 ? (totalMaterialAmount / totalContractAmount) * 100 : 0;
  const laborPercent = totalContractAmount > 0 ? (totalLaborAmount / totalContractAmount) * 100 : 0;

  // Filter out only '미분류' for the standard category matrix (미분류 gets its own dedicated card)
  const classifiedItems = items.filter(item => {
    const cat = item.category || '미분류';
    return cat !== '미분류';
  });

  // Calculate totals by category for classified items
  const categoryData = classifiedItems.reduce((acc, item) => {
    const itemCat = item.category || '미분류';
    const isSafety = isSafetyEquipmentItem(item);
    const matAmt = getItemMaterialAmount(item);
    const labAmt = getItemLaborCost(item, separationMethod);
    const itemAmt = isSafety ? (item.amount || (item.materialAmount || 0) + (item.laborAmount || 0)) : (matAmt + labAmt);

    if (!acc[itemCat]) acc[itemCat] = { amount: 0, materialAmount: 0, laborAmount: 0, count: 0 };
    acc[itemCat].amount += itemAmt;
    acc[itemCat].materialAmount += isSafety ? (item.materialAmount || itemAmt) : matAmt;
    acc[itemCat].laborAmount += isSafety ? (item.laborAmount || 0) : labAmt;
    acc[itemCat].count += 1;
    
    return acc;
  }, {} as Record<string, { amount: number; materialAmount: number; laborAmount: number; count: number }>);

  // 1. Follow the provided categories array order (excluding '안전장비류' and outsourcing categories)
  const sortedCategories = categories
    .filter(name => name !== '안전장비류' && !isOutsourcingCategory(name))
    .map(name => {
      const data = categoryData[name];
      if (!data) return null;
      return {
        name,
        ...data,
        percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
      };
    })
    .filter((cat): cat is { name: string; amount: number; materialAmount: number; laborAmount: number; count: number; percentage: number } => cat !== null);

  // 2. Append extra regular categories (not in categories, not '안전장비류', not outsourcing)
  const extraCategories = Object.entries(categoryData)
    .filter(([name]) => !categories.includes(name) && name !== '안전장비류' && !isOutsourcingCategory(name))
    .map(([name, data]) => ({
      name,
      ...data,
      percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Safety Category (안전장비류)
  const rawSafetyData = categoryData['안전장비류'] || { amount: safetyEquipmentAmount, materialAmount: safetyEquipmentAmount, laborAmount: 0, count: 0 };
  const safetyData = {
    ...rawSafetyData,
    amount: rawSafetyData.amount > 0 ? rawSafetyData.amount : safetyEquipmentAmount
  };
  const safetyCategory = {
    name: '안전장비류',
    amount: safetyData.amount,
    materialAmount: safetyData.materialAmount,
    laborAmount: safetyData.laborAmount,
    count: safetyData.count,
    percentage: totalContractAmount > 0 ? (safetyData.amount / totalContractAmount) * 100 : 0
  };

  // 4. Outsourcing Categories (외주, 외주비, 외주비+덕트덕 등)
  const sortedOutsourcingCategories = categories
    .filter(name => isOutsourcingCategory(name) && !isIndirectCostCategory(name) && !isClientSuppliedCategory(name))
    .map(name => {
      const data = categoryData[name];
      if (!data) return null;
      return {
        name,
        ...data,
        percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
      };
    })
    .filter((cat): cat is { name: string; amount: number; materialAmount: number; laborAmount: number; count: number; percentage: number } => cat !== null);

  const extraOutsourcingCategories = Object.entries(categoryData)
    .filter(([name]) => !categories.includes(name) && isOutsourcingCategory(name) && !isIndirectCostCategory(name) && !isClientSuppliedCategory(name))
    .map(([name, data]) => ({
      name,
      ...data,
      percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const outsourcingCategories = [...sortedOutsourcingCategories, ...extraOutsourcingCategories];

  // 5. Indirect Costs and Client Supplied Materials (반드시 가장 뒤에 배치)
  const indirectAndSuppliedCategories = Object.entries(categoryData)
    .filter(([name]) => isIndirectCostCategory(name) || isClientSuppliedCategory(name))
    .map(([name, data]) => ({
      name,
      ...data,
      percentage: totalContractAmount > 0 ? (data.amount / totalContractAmount) * 100 : 0
    }))
    .sort((a, b) => {
      // 간접비 먼저, 그 다음 지급자재
      const aIsIndirect = isIndirectCostCategory(a.name);
      const bIsIndirect = isIndirectCostCategory(b.name);
      if (aIsIndirect && !bIsIndirect) return -1;
      if (!aIsIndirect && bIsIndirect) return 1;
      return b.amount - a.amount;
    });

  // Final order: 일반 재료비 카테고리 -> 안전장비류 -> 외주비 카테고리 -> 간접비/지급자재
  const filteredFinalCategories = [...sortedCategories, ...extraCategories]
    .filter(cat => !isOutsourcingCategory(cat.name) && !isIndirectCostCategory(cat.name) && !isClientSuppliedCategory(cat.name) && cat.name !== '안전장비류');

  if (safetyData.count > 0 || categories.includes('안전장비류')) {
    filteredFinalCategories.push(safetyCategory);
  }
  
  filteredFinalCategories.push(...outsourcingCategories);
  filteredFinalCategories.push(...indirectAndSuppliedCategories);

  const unclassifiedItemsList = items.filter(item => !item.category || item.category === '미분류');
  const unclassifiedCount = unclassifiedItemsList.length;
  const unclassifiedAmount = unclassifiedItemsList.reduce((sum, item) => sum + (item.amount || getItemCategoryAmount(item)), 0);

  const displayProjectName = projectName?.trim() || '기본 프로젝트 (현장 미지정)';

  // High-Density Theme Rendering
  if (theme === 'high-density') {
    return (
      <div className="mb-6 bg-white border border-[#141414]">
        {/* Prominent Site Name Banner */}
        <div className="bg-[#141414] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-yellow-400 text-black font-black text-xs flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-yellow-400">현장명 (SITE NAME)</span>
                <span className="text-[10px] font-mono px-1 bg-white/20 text-white font-bold">
                  {isProjectLocked ? '완료/잠김' : '작업중'}
                </span>
              </div>
              <h2 className="text-base font-black tracking-tight leading-tight uppercase text-white">
                {displayProjectName}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenStats?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#141414] hover:bg-yellow-400 hover:text-black text-[#141414] rounded text-[10px] font-black uppercase transition-all shadow-[2px_2px_0_0_#141414] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <BarChart3 size={11} />
              상세 통계 리포트
            </button>
            <div className="bg-white/10 px-2.5 py-1 border border-white/20 text-right">
              <span className="text-[9px] uppercase opacity-70 block">총 계약 합계 (재료비+외주)</span>
              <span className="text-sm font-mono font-black text-yellow-400">₩{totalContractAmount.toLocaleString()}</span>
            </div>
            <div className="bg-amber-500/20 px-2.5 py-1 border border-amber-400/40 text-right">
              <span className="text-[9px] uppercase text-amber-200 block font-bold">[별도] 안전장비류</span>
              <span className="text-xs font-mono font-bold text-amber-300">₩{safetyData.amount.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 border border-white/10 text-right">
              <span className="text-[9px] uppercase opacity-70 block">재료비: {materialPercent.toFixed(1)}%</span>
              <span className="text-xs font-mono font-bold text-sky-300">₩{totalMaterialAmount.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 border border-white/10 text-right">
              <span className="text-[9px] uppercase opacity-70 block">외주/시공: {laborPercent.toFixed(1)}%</span>
              <span className="text-xs font-mono font-bold text-amber-300">₩{totalLaborAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="bg-[#F2F2F2] border-b border-[#141414] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-black">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Tags size={13} />
              <span className="text-[11px] font-black uppercase tracking-wider">
                카테고리별 공정 분리 요약
              </span>
            </div>
            {onRenameCategory && (
              <button
                onClick={(e) => openRenameModal(undefined, e)}
                className="flex items-center gap-1 px-2 py-0.5 bg-white border border-[#141414] hover:bg-yellow-400 text-slate-900 rounded text-[10px] font-black uppercase transition-all shadow-[1px_1px_0_0_#141414] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                title="카테고리 명칭 수동 수정"
              >
                <Edit2 size={10} />
                카테고리명 수정
              </button>
            )}
            <button 
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-black uppercase transition-all ${
                showComparison 
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]' 
                : 'bg-white text-slate-700 border-[#141414] hover:bg-[#EBEAE8]'
              }`}
            >
              <Calculator size={10} />
              수기 물량 비교 {showComparison ? 'OFF' : 'ON'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSeparationMethod?.(separationMethod === 'method1' ? 'method2' : 'method1');
              }}
              className={`flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-black uppercase transition-all ${
                separationMethod === 'method2' 
                ? 'bg-yellow-400 text-black border-[#141414] shadow-[1px_1px_0_0_#141414]' 
                : 'bg-white text-slate-500 border-[#141414] hover:bg-[#EBEAE8]'
              }`}
              title="분리 방식 전환: 방식1(표준) vs 방식2(공정분리/외주턴키)"
            >
              <Workflow size={10} />
              {separationMethod === 'method2' ? '공정분리방식 (B2)' : '표준분리방식 (B1)'}
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-mono">
            <span className="hidden md:inline text-[10px] text-slate-500 font-normal">
              💡 카드의 ✏️ 클릭 또는 명칭 더블클릭 시 수동 변경 가능
            </span>
            <span className="opacity-40 hidden md:inline">|</span>
            <span className="font-bold">총 품목: {items.length}건</span>
            <span className="opacity-50">|</span>
            <span className="text-indigo-700 font-bold">분류군: {filteredFinalCategories.length}개</span>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-0 divide-x divide-y divide-[#141414]">
          {/* Total Summary Card */}
          <div 
            onClick={() => onCategoryClick?.('all')}
            className="p-3 flex flex-col justify-between bg-indigo-50 hover:bg-indigo-100 transition-colors border-[#141414] cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-black text-indigo-700 uppercase">총계약 합계 (TOTAL)</span>
              <span className="text-[10px] font-mono font-bold bg-indigo-600 text-white px-1">100%</span>
            </div>
            <div className="flex flex-col mb-2">
              <span className="text-base font-mono font-black italic tracking-tighter text-indigo-900 leading-tight">
                ₩{totalContractAmount.toLocaleString()}
              </span>
              <span className="text-[10px] opacity-60 uppercase font-bold text-indigo-700">전체 품목 종합</span>
            </div>
            <div className="pt-1.5 border-t border-indigo-200/80 space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between text-slate-700">
                <span>재료비:</span>
                <span className="font-bold text-blue-700">₩{totalMaterialAmount.toLocaleString()} ({materialPercent.toFixed(0)}%)</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>외주비:</span>
                <span className="font-bold text-amber-700">₩{totalLaborAmount.toLocaleString()} ({laborPercent.toFixed(0)}%)</span>
              </div>
            </div>
          </div>

          {/* Unassigned Warning Card */}
          {unclassifiedCount > 0 && (
            <div 
              onClick={() => onCategoryClick?.('미분류')}
              className="p-3 flex flex-col justify-between bg-[#FFF2CC] hover:bg-[#FCE4D6] transition-colors border-l-4 border-l-amber-600 border-y border-r border-[#141414] cursor-pointer"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-black text-amber-800 uppercase">⚠️ 미분류 합계</span>
                <span className="text-[9px] font-mono font-bold bg-amber-600 text-white px-1">분류 대기</span>
              </div>
              <div className="flex flex-col mb-2">
                <span className="text-base font-mono font-black italic tracking-tighter text-amber-900 leading-tight">
                  ₩{unclassifiedAmount.toLocaleString()}
                </span>
                <span className="text-[10px] opacity-75 text-amber-800 uppercase font-black">{unclassifiedCount}개 품목 지정 필요</span>
              </div>
              <div className="text-[9px] text-amber-800 font-bold bg-amber-200/70 px-1 py-0.5 text-center">
                클릭 시 미분류 목록 필터
              </div>
            </div>
          )}

          {/* Category Cards */}
          {filteredFinalCategories.map((cat) => {
            const isOutsourcing = isOutsourcingCategory(cat.name);
            const isSafety = cat.name === '안전장비류';
            const isClientSupplied = isClientSuppliedCategory(cat.name);
            const isIndirect = isIndirectCostCategory(cat.name);

            if (isSafety) {
              return (
                <div 
                  key={cat.name} 
                  onClick={() => onCategoryClick?.(cat.name)}
                  className={`p-3 flex flex-col justify-between bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors border-[#141414] cursor-pointer border-l-4 ${showComparison ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                  style={{ borderLeftColor: categoryColors[cat.name] || '#4f46e5' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    {editingCategoryName === cat.name ? (
                      <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={categoryNameInput}
                          onChange={(e) => setCategoryNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(cat.name, e);
                            else if (e.key === 'Escape') handleCancelRename(e);
                          }}
                          className="w-full px-1.5 py-0.5 text-xs font-bold border border-indigo-500 rounded outline-none bg-white text-slate-800 shadow-xs focus:ring-1 focus:ring-indigo-400"
                          autoFocus
                          placeholder="카테고리명..."
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveRename(cat.name, e)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                          title="저장 (Enter)"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCancelRename(e)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="취소 (Esc)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 truncate group/title flex-1 min-w-0 mr-1">
                        <span 
                          className="text-[11px] font-black text-indigo-700 uppercase truncate cursor-text" 
                          title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                          onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                        >
                          🛡️ {cat.name}
                        </span>
                        {onRenameCategory && (
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(cat.name, e)}
                            className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/60 rounded transition-all shrink-0"
                            title="카테고리명 수정"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {!showComparison && editingCategoryName !== cat.name && (
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 border border-amber-300 rounded shrink-0">
                        [별도/계약제외]
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {isEditingSafety ? (
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-mono font-bold text-indigo-600">₩</span>
                        <input
                          type="text"
                          value={safetyInputVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSafetyInputVal(val ? Number(val).toLocaleString() : '');
                          }}
                          onBlur={() => {
                            setIsEditingSafety(false);
                            const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                            onUpdateSafetyAmount?.(Number(rawVal) || 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingSafety(false);
                              const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                              onUpdateSafetyAmount?.(Number(rawVal) || 0);
                            } else if (e.key === 'Escape') {
                              setIsEditingSafety(false);
                            }
                          }}
                          className="w-full px-1.5 py-0.5 text-xs font-mono border border-indigo-500 rounded outline-none bg-white font-bold"
                          placeholder="금액..."
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono font-black italic tracking-tighter text-indigo-900">₩{cat.amount.toLocaleString()}</span>
                          {!showComparison && (
                            <span 
                              className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200 shadow-xs flex items-center" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                                setIsEditingSafety(true);
                              }}
                            >
                              수동 ✎
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-0.5 pt-0.5 border-t border-indigo-100">
                          <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-blue-600 font-bold">재료비:</span>
                            <span className="text-blue-700">₩{cat.materialAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-amber-600 font-bold">노무비:</span>
                            <span className="text-amber-700">₩{cat.laborAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {!showComparison && <span className="text-[9px] opacity-50 uppercase font-bold text-indigo-700">{cat.count} items</span>}
                    
                    {showComparison && (
                      <div className="mt-1 pt-1 border-t border-dashed border-indigo-200/50 space-y-1">
                        <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] font-black text-indigo-600">수기:</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-white border border-indigo-200 px-1 py-0.5 text-[9px] font-mono font-bold text-indigo-900"
                          />
                        </div>
                        {categoryEstimates[cat.name] > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-indigo-400">대비:</span>
                            <span className={`text-[9px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (isOutsourcing) {
              return (
                <div 
                  key={cat.name} 
                  onClick={() => onCategoryClick?.(cat.name)}
                  className={`p-3 flex flex-col justify-between bg-amber-50/50 hover:bg-amber-100/60 transition-colors border-[#141414] cursor-pointer border-l-4 ${showComparison ? 'ring-1 ring-inset ring-amber-200' : ''}`}
                  style={{ borderLeftColor: categoryColors[cat.name] || '#f59e0b' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    {editingCategoryName === cat.name ? (
                      <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={categoryNameInput}
                          onChange={(e) => setCategoryNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(cat.name, e);
                            else if (e.key === 'Escape') handleCancelRename(e);
                          }}
                          className="w-full px-1.5 py-0.5 text-xs font-bold border border-amber-500 rounded outline-none bg-white text-slate-800 shadow-xs focus:ring-1 focus:ring-amber-400"
                          autoFocus
                          placeholder="카테고리명..."
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveRename(cat.name, e)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                          title="저장 (Enter)"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCancelRename(e)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="취소 (Esc)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 truncate group/title flex-1 min-w-0 mr-1">
                        <span 
                          className="text-[11px] font-black text-amber-900 uppercase truncate flex items-center gap-1 cursor-text" 
                          title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                          onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                        >
                          🛠️ {cat.name}
                        </span>
                        {onRenameCategory && (
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(cat.name, e)}
                            className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-200/60 rounded transition-all shrink-0"
                            title="카테고리명 수정"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {!showComparison && editingCategoryName !== cat.name && (
                      <span className="text-[11px] font-mono font-bold bg-amber-200 text-amber-900 px-1 border border-amber-300 shrink-0">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-mono font-black italic tracking-tighter text-amber-950">
                      ₩{cat.amount.toLocaleString()}
                    </span>
                    <div className="flex flex-col gap-0.5 mt-0.5 pt-0.5 border-t border-amber-200/50">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-amber-700 font-bold">재료비:</span>
                        <span className="text-amber-800">₩{cat.materialAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-amber-800 font-bold">노무비:</span>
                        <span className="text-amber-900">₩{cat.laborAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    {!showComparison && (
                      <div className="flex justify-between items-center text-[10px] text-amber-800 mt-1 font-mono">
                        <span>{cat.count} items</span>
                        <span className="font-bold">외주</span>
                      </div>
                    )}

                    {showComparison && (
                      <div className="mt-1 pt-1 border-t border-dashed border-amber-300/50 space-y-1">
                        <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] font-black text-amber-700">수기:</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full bg-white border border-amber-200 px-1 py-0.5 text-[9px] font-mono font-bold text-amber-900"
                          />
                        </div>
                        {categoryEstimates[cat.name] > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-amber-600">대비:</span>
                            <span className={`text-[9px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={cat.name} 
                onClick={() => onCategoryClick?.(cat.name)}
                className={`p-3 flex flex-col justify-between hover:bg-[#F9F9F9] transition-colors border-[#141414] cursor-pointer border-t-2 ${showComparison ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                style={{ borderTopColor: categoryColors[cat.name] || '#cbd5e1' }}
              >
                <div className="flex justify-between items-start mb-1">
                  {editingCategoryName === cat.name ? (
                    <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={categoryNameInput}
                        onChange={(e) => setCategoryNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(cat.name, e);
                          else if (e.key === 'Escape') handleCancelRename(e);
                        }}
                        className="w-full px-1.5 py-0.5 text-xs font-bold border border-indigo-500 rounded outline-none bg-white text-slate-800 shadow-xs focus:ring-1 focus:ring-indigo-400"
                        autoFocus
                        placeholder="카테고리명..."
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(cat.name, e)}
                        className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                        title="저장 (Enter)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCancelRename(e)}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        title="취소 (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 truncate group/title flex-1 min-w-0 mr-1">
                      <span 
                        className="text-[11px] font-black text-slate-600 uppercase truncate flex items-center gap-1 cursor-text" 
                        title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                        onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                      >
                        {cat.name}
                        {isClientSupplied && <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">지급자재</span>}
                        {isIndirect && <span className="text-[9px] px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-bold">간접비</span>}
                      </span>
                      {onRenameCategory && (
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(cat.name, e)}
                          className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-all shrink-0"
                          title="카테고리명 수정"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {!showComparison && editingCategoryName !== cat.name && (
                    <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-700 px-1 border border-blue-200 shrink-0">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-mono font-black italic tracking-tighter">₩{cat.amount.toLocaleString()}</span>
                    <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-blue-500 font-bold">재료비:</span>
                        <span className="text-blue-600">₩{cat.materialAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-amber-600 font-bold">노무비:</span>
                        <span className="text-amber-700">₩{cat.laborAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    {!showComparison && <span className="text-[10px] opacity-50 uppercase font-bold mt-0.5">{cat.count} items</span>}
                  </div>

                  {showComparison && (
                    <div className="mt-1 pt-1.5 border-t border-dashed border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] font-black text-indigo-600">수기:</span>
                        <div className="relative flex-grow">
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="실행물량..."
                            className="w-full bg-slate-50 border border-slate-200 px-1 py-0.5 text-[10px] font-mono font-bold text-indigo-900 outline-none focus:border-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      
                      {categoryEstimates[cat.name] && categoryEstimates[cat.name] > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-400">대비:</span>
                          <span className={`text-[10px] font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                            {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      ) : (
                        <div className="text-[8px] italic text-slate-400 text-center">수기 금액 입력 시 대비 계산</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard (Industrial / Modern / Minimal) Theme Rendering
  return (
    <div className="mb-10 space-y-5">
      {/* 1. Prominent Site Name Banner with Grand Total Breakdown */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-50/70 via-slate-50/40 to-transparent rounded-full pointer-events-none -mr-16 -mt-16" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Site Identity */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-indigo-200 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-extrabold uppercase tracking-wider border border-indigo-100">
                  현재 작업 현장
                </span>
                {isProjectLocked ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-bold border border-emerald-200">
                    <ShieldCheck size={12} /> 완료 및 보호됨
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-medium">
                    내역 분리 진행중
                  </span>
                )}
                <span className="text-xs text-slate-400 font-medium">
                  총 {items.length}개 품목 ({filteredFinalCategories.length}개 카테고리)
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {displayProjectName}
              </h1>
            </div>
          </div>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStats?.();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-xl text-xs font-black transition-all shadow-sm"
              >
                <BarChart3 size={14} />
                분석 리포트 상세 보기
              </button>
              <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                <div className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">총 계약 합계 금액</div>
                <div className="text-xl md:text-2xl font-mono font-black tracking-tight">
                  ₩{totalContractAmount.toLocaleString()}
                </div>
                <div className="mt-1 pt-1 border-t border-indigo-400/40 flex items-center justify-between text-[10px]">
                  <span className="text-amber-200 font-bold">[별도] 안전장비류:</span>
                  <span className="font-mono font-bold text-amber-300">₩{safetyData.amount.toLocaleString()}</span>
                </div>
              </div>

            {/* Split: Material vs Outsourcing */}
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase">
                  <Package size={12} />
                  <span>재료비 합계 ({materialPercent.toFixed(1)}%)</span>
                </div>
                <div className="text-base font-mono font-black text-slate-800">
                  ₩{totalMaterialAmount.toLocaleString()}
                </div>
              </div>

              <div className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase">
                  <Wrench size={12} />
                  <span>외주비 합계 ({laborPercent.toFixed(1)}%)</span>
                </div>
                <div className="text-base font-mono font-black text-slate-800">
                  ₩{totalLaborAmount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proportional Split Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> 재료비: ₩{totalMaterialAmount.toLocaleString()} ({materialPercent.toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 외주 및 시공비: ₩{totalLaborAmount.toLocaleString()} ({laborPercent.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-blue-500 transition-all duration-500" 
              style={{ width: `${materialPercent}%` }} 
              title={`재료비: ${materialPercent.toFixed(1)}%`}
            />
            <div 
              className="h-full bg-amber-500 transition-all duration-500" 
              style={{ width: `${laborPercent}%` }} 
              title={`외주비: ${laborPercent.toFixed(1)}%`}
            />
          </div>
        </div>
      </motion.div>

      {/* 2. Category Summary Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shadow-xs border border-indigo-200">
              <PieChartIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-0.5">카테고리별 공종 금액 일람</h2>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Category-wise Expenditure Summary (재료비 + 외주)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {onRenameCategory && (
              <button
                onClick={(e) => openRenameModal(undefined, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-xs active:scale-95"
                title="카테고리 명칭 수동 수정"
              >
                <Edit2 size={13} className="text-amber-700" />
                <span>카테고리명 수정</span>
              </button>
            )}
            <button 
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                showComparison 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'
              }`}
            >
              <Calculator size={10} />
              수기 물량 비교 {showComparison ? 'OFF' : 'ON'}
            </button>
            
            <button 
              onClick={() => onUpdateSeparationMethod?.(separationMethod === 'method1' ? 'method2' : 'method1')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                separationMethod === 'method2' 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'
              }`}
              title="분리 방식 전환: 방식1(표준) vs 방식2(공정분리/외주턴키)"
            >
              <Workflow size={14} />
              {separationMethod === 'method2' ? '공정분리방식 ON' : '표준분리방식'}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              <TrendingUp size={14} />
              <span>총 {filteredFinalCategories.length}개 카테고리</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Total Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onCategoryClick?.('all')}
            className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-200/70 border border-indigo-500 relative overflow-hidden group cursor-pointer text-white flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-white/10 rounded-full blur-2xl" />
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-100">
                  총계약 합계 (전체)
                </span>
                <PieChartIcon size={16} className="text-indigo-200" />
              </div>
              <div className="text-2xl font-mono font-black mb-3 tracking-tight">
                ₩{totalContractAmount.toLocaleString()}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-indigo-400/40 text-[11px] font-medium text-indigo-100">
              <div className="flex justify-between items-center">
                <span>재료비 ({materialPercent.toFixed(0)}%)</span>
                <span className="font-mono font-bold">₩{totalMaterialAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>외주비 ({laborPercent.toFixed(0)}%)</span>
                <span className="font-mono font-bold">₩{totalLaborAmount.toLocaleString()}</span>
              </div>
              <div className="pt-1 flex justify-between items-center text-[10px] text-indigo-200">
                <span>전체 품목 수</span>
                <span className="font-mono font-bold">{items.length}개</span>
              </div>
            </div>
          </motion.div>

          {/* Unassigned Warning Card */}
          {unclassifiedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onCategoryClick?.('미분류')}
              className="bg-amber-50 p-5 rounded-2xl border border-amber-200 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden border-l-4 border-l-amber-500 cursor-pointer flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-amber-100 rounded-full blur-2xl" />
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest">
                    ⚠️ 미분류 합계
                  </span>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    분류 필요
                  </span>
                </div>
                
                <div className="text-xl font-mono font-black text-amber-900 mb-3">
                  ₩{unclassifiedAmount.toLocaleString()}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 pt-2 border-t border-amber-200/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[11px] text-amber-800 font-bold uppercase">대기 품목</span>
                  <span className="text-[11px] text-amber-900 font-bold font-mono">{unclassifiedCount}개 품목</span>
                </div>
                <div className="text-[10px] text-amber-700 font-medium">
                  클릭하여 미분류 품목 일괄 지정
                </div>
              </div>
            </motion.div>
          )}

          {/* Category Cards */}
          {filteredFinalCategories.map((cat, idx) => {
            const isOutsourcing = isOutsourcingCategory(cat.name);
            const isSafety = cat.name === '안전장비류';
            const isClientSupplied = isClientSuppliedCategory(cat.name);
            const isIndirect = isIndirectCostCategory(cat.name);

            if (isSafety) {
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onCategoryClick?.(cat.name)}
                  className="bg-indigo-50/40 p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer border-l-4 border-l-indigo-600 flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-indigo-100 rounded-full blur-2xl" />
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      {editingCategoryName === cat.name ? (
                        <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={categoryNameInput}
                            onChange={(e) => setCategoryNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(cat.name, e);
                              else if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            className="w-full px-2 py-1 text-xs font-bold border border-indigo-500 rounded-lg outline-none bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-400"
                            autoFocus
                            placeholder="카테고리명..."
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(cat.name, e)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                            title="저장 (Enter)"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCancelRename(e)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                            title="취소 (Esc)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 truncate group/title flex-1 min-w-0 mr-1">
                          <span 
                            className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1 cursor-text"
                            title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                            onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                          >
                            🛡️ {cat.name}
                          </span>
                          {onRenameCategory && (
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(cat.name, e)}
                              className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/70 rounded-md transition-all shrink-0"
                              title="카테고리명 수정"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {editingCategoryName !== cat.name && (
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 shrink-0">
                          [별도 / 총 계약 제외]
                        </span>
                      )}
                    </div>
                    
                    {isEditingSafety ? (
                      <div className="flex flex-col gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-black text-indigo-600 uppercase">안전장비류 금액 입력</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono font-bold text-slate-400">₩</span>
                          <input
                            type="text"
                            value={safetyInputVal}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setSafetyInputVal(val ? Number(val).toLocaleString() : '');
                            }}
                            onBlur={() => {
                              setIsEditingSafety(false);
                              const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                              onUpdateSafetyAmount?.(Number(rawVal) || 0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setIsEditingSafety(false);
                                const rawVal = safetyInputVal.replace(/[^0-9]/g, '');
                                onUpdateSafetyAmount?.(Number(rawVal) || 0);
                              } else if (e.key === 'Escape') {
                                setIsEditingSafety(false);
                              }
                            }}
                            className="w-full px-2 py-1 text-xs font-mono border border-indigo-500 rounded-lg outline-none bg-white font-bold"
                            placeholder="금액 입력..."
                            autoFocus
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xl font-mono font-black text-slate-900 group-hover:scale-[1.02] origin-left transition-transform">
                          ₩{cat.amount.toLocaleString()}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSafetyInputVal(cat.amount ? String(cat.amount) : '');
                            setIsEditingSafety(true);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-slate-50 px-2 py-0.5 rounded-full border border-indigo-200 shadow-2xs transition-all"
                        >
                          수동 ✎
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center border-t border-indigo-100/70 pt-2 font-bold text-indigo-600 text-xs">
                    <span className="text-[10px] uppercase">등록 품목</span>
                    <span className="text-[11px] font-mono">{cat.count}건 (수동 입력)</span>
                  </div>
                </motion.div>
              );
            }

            if (isOutsourcing) {
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => onCategoryClick?.(cat.name)}
                  className="bg-amber-50/40 p-5 rounded-2xl border-2 border-amber-200/80 shadow-xs hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer border-l-4 border-l-amber-500 flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 bg-amber-100 rounded-full blur-2xl group-hover:bg-amber-200/60 transition-colors" />
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      {editingCategoryName === cat.name ? (
                        <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={categoryNameInput}
                            onChange={(e) => setCategoryNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(cat.name, e);
                              else if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            className="w-full px-2 py-1 text-xs font-bold border border-amber-500 rounded-lg outline-none bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-amber-400"
                            autoFocus
                            placeholder="카테고리명..."
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(cat.name, e)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                            title="저장 (Enter)"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCancelRename(e)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                            title="취소 (Esc)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 truncate group/title flex-1 min-w-0 mr-1">
                          <span 
                            className="text-[11px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1 cursor-text"
                            title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                            onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                          >
                            🛠️ {cat.name} (외주비)
                          </span>
                          {onRenameCategory && (
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(cat.name, e)}
                              className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-amber-800 hover:bg-amber-200/70 rounded-md transition-all shrink-0"
                              title="카테고리명 수정"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {editingCategoryName !== cat.name && (
                        <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                          {cat.percentage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    
                    <div className="text-xl font-mono font-black text-slate-900 mb-2 group-hover:scale-[1.02] origin-left transition-transform">
                      ₩{cat.amount.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-2 border-t border-amber-200/60">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, cat.percentage)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.03 }}
                        style={{ backgroundColor: categoryColors[cat.name] || '#6366f1' }}
                        className="h-full rounded-full" 
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">외주 품목수</span>
                      <span className="text-[11px] text-slate-900 font-bold font-mono">{cat.count}건</span>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => onCategoryClick?.(cat.name)}
                style={{ borderLeft: `4px solid ${categoryColors[cat.name] || '#e2e8f0'}` }}
                className={`bg-white p-5 rounded-2xl border transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between ${
                  showComparison ? 'border-indigo-300 shadow-md ring-1 ring-indigo-100' : 'border-slate-200 shadow-2xs hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5'
                }`}
              >
                <div 
                  className="absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full blur-2xl group-hover:opacity-80 transition-opacity" 
                  style={{ backgroundColor: categoryColors[cat.name] || '#f8fafc', opacity: 0.1 }}
                />
                
                <div>
                  <div className="flex justify-between items-start mb-2">
                    {editingCategoryName === cat.name ? (
                      <div className="flex items-center gap-1 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={categoryNameInput}
                          onChange={(e) => setCategoryNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(cat.name, e);
                            else if (e.key === 'Escape') handleCancelRename(e);
                          }}
                          className="w-full px-2 py-1 text-xs font-bold border border-indigo-500 rounded-lg outline-none bg-white text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-400"
                          autoFocus
                          placeholder="카테고리명..."
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveRename(cat.name, e)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                          title="저장 (Enter)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCancelRename(e)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="취소 (Esc)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 truncate group/title flex-1 min-w-0 mr-1">
                        <span 
                          className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors truncate flex items-center gap-1.5 cursor-text" 
                          title={`${cat.name} (더블클릭 또는 연필 아이콘으로 수정)`}
                          onDoubleClick={(e) => onRenameCategory && handleStartRename(cat.name, e)}
                          style={{ color: categoryColors[cat.name] ? `${categoryColors[cat.name]}ee` : undefined }}
                        >
                          {cat.name}
                          {isClientSupplied && <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">지급자재</span>}
                          {isIndirect && <span className="text-[9px] px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded font-bold">간접비</span>}
                        </span>
                        {onRenameCategory && (
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(cat.name, e)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all shrink-0"
                            title="카테고리명 수정"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {!showComparison && editingCategoryName !== cat.name && (
                      <span 
                        className="text-[11px] font-black px-2 py-0.5 rounded-md border shrink-0"
                        style={{ 
                          backgroundColor: categoryColors[cat.name] ? `${categoryColors[cat.name]}15` : '#f1f5f9',
                          color: categoryColors[cat.name] || '#475569',
                          borderColor: categoryColors[cat.name] ? `${categoryColors[cat.name]}30` : '#e2e8f0'
                        }}
                      >
                        {cat.percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xl font-mono font-black text-slate-900 mb-2 group-hover:scale-[1.02] origin-left transition-transform">
                    ₩{cat.amount.toLocaleString()}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  {showComparison ? (
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[9px] font-black text-indigo-500 uppercase">수기 실행물량</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-slate-400">₩</span>
                          <input
                            type="text"
                            value={editingEstimate === cat.name ? estimateInput : (categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '')}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setEstimateInput(val ? Number(val).toLocaleString() : '');
                            }}
                            onFocus={() => {
                              setEditingEstimate(cat.name);
                              setEstimateInput(categoryEstimates[cat.name] ? categoryEstimates[cat.name].toLocaleString() : '');
                            }}
                            onBlur={() => {
                              if (editingEstimate === cat.name) {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const rawVal = estimateInput.replace(/[^0-9]/g, '');
                                onUpdateCategoryEstimate?.(cat.name, Number(rawVal) || 0);
                                setEditingEstimate(null);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="실행 금액 입력"
                            className="w-full bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono font-bold text-indigo-900 rounded-md outline-none focus:border-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>
                      
                      {categoryEstimates[cat.name] && categoryEstimates[cat.name] > 0 ? (
                        <div className="flex items-center justify-between bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100/50">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">대비(Ratio)</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-mono font-black ${(categoryEstimates[cat.name] / cat.amount) > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                              {cat.amount > 0 ? ((categoryEstimates[cat.name] / cat.amount) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] italic text-slate-400 text-center py-1">실행물량 입력 대기</div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, cat.percentage)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.03 }}
                          style={{ backgroundColor: categoryColors[cat.name] || '#6366f1' }}
                          className="h-full rounded-full transition-colors shadow-xs" 
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">포함 품목</span>
                        <span className="text-[11px] text-slate-600 font-bold font-mono">{cat.count}건</span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Manual Category Rename Modal */}
      {isRenameModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsRenameModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm tracking-tight">카테고리 명칭 수동 수정</h3>
              </div>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyModalRename} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  변경할 대상 카테고리 선택
                </label>
                <select
                  value={modalSelectedCategory}
                  onChange={(e) => {
                    setModalSelectedCategory(e.target.value);
                    setModalNewCategoryName(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="" disabled>카테고리를 선택하세요</option>
                  {filteredFinalCategories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count}건 / ₩{c.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  새 카테고리 명칭
                </label>
                <input
                  type="text"
                  value={modalNewCategoryName}
                  onChange={(e) => setModalNewCategoryName(e.target.value)}
                  placeholder="예: 배관공사, 외주비+특수덕트, 안전관리비"
                  autoFocus
                  className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none shadow-xs"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                <span className="font-bold block mb-0.5">안내 사항:</span>
                • 카테고리명을 변경하면 해당 카테고리에 할당된 모든 내역서 품목, 맞춤 분류 규칙, 그래프 및 견적 통계가 즉시 일괄 갱신됩니다.<br />
                • 카테고리 카드에서 명칭을 <b>더블클릭</b>하거나 ✏️ 아이콘을 눌러 실시간 인라인 수정도 가능합니다.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!modalSelectedCategory || !modalNewCategoryName.trim() || modalSelectedCategory === modalNewCategoryName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
                >
                  변경 적용하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

