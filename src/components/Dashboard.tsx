import React, { useMemo } from 'react';
import { SpecItem, ThemeType, SeparationMethod } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, TrendingUp, Info, LayoutGrid, ArrowRight, Package, Wrench, Shield, Workflow } from 'lucide-react';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  getItemContractAmount,
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
  onOpenSectionSummary: () => void;
  separationMethod?: SeparationMethod;
  onUpdateSeparationMethod?: (method: SeparationMethod) => void;
  // Project metadata
  metadata?: {
    commencementDate?: string;
    completionDate?: string;
    buildingCount?: string;
    householdCount?: string;
    highestFloor?: string;
    lowestFloor?: string;
  };
  onUpdateMetadata?: (key: string, value: string) => void;
}

export default function Dashboard({ 
  items, 
  theme, 
  onOpenSectionSummary,
  separationMethod = 'method2',
  onUpdateSeparationMethod,
  metadata = {},
  onUpdateMetadata
}: Props) {
  if (!items || items.length === 0) return null;

  const MetadataInput = ({ label, value, field, placeholder }: { label: string, value?: string, field: string, placeholder: string }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black uppercase opacity-50">{label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onUpdateMetadata?.(field, e.target.value)}
        placeholder={placeholder}
        className={`bg-transparent border-none p-0 text-[11px] font-bold focus:ring-0 outline-none placeholder:text-slate-400 ${
          theme === 'high-density' ? 'text-black' : 'text-slate-700'
        }`}
      />
    </div>
  );
  
  // Material vs Labor calculation
  const getItemMaterialAmount = (item: SpecItem): number => {
    return getItemMaterialCost(item, separationMethod);
  };

  const getItemLaborAmount = (item: SpecItem): number => {
    return getItemLaborCost(item, separationMethod);
  };

  const costBreakdown = useMemo(() => calculateCostBreakdown(items, separationMethod), [items, separationMethod]);

  // 안전장비류는 총 계약 합계 금액(TOTAL)에서 제외
  const totalContractAmount = costBreakdown.totalContractAmount;
  const totalMaterialAmount = costBreakdown.materialCost;
  const totalLaborAmount = costBreakdown.totalLaborAndOutsourcing;

  const materialPercent = totalContractAmount > 0 ? (totalMaterialAmount / totalContractAmount) * 100 : 0;
  const laborPercent = totalContractAmount > 0 ? (totalLaborAmount / totalContractAmount) * 100 : 0;

  // For chart, include all classified categories (안전장비류는 별도 관리이므로 차트에서 제외)
  const classifiedItems = items.filter(item => {
    const cat = item.category || '미분류';
    return cat !== '미분류' && !isSafetyEquipmentItem(item);
  });

  const categoryTotals = classifiedItems.reduce((acc, item) => {
    const itemCat = item.category || '미분류';
    const matAmt = getItemMaterialAmount(item);
    const labAmt = getItemLaborAmount(item);

    acc[itemCat] = (acc[itemCat] || 0) + matAmt + labAmt;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const colors = ['#4F46E5', '#0284C7', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  if (theme === 'high-density') {
    return (
      <div className="border-b border-[#141414] bg-[#F4F4F2]">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-0 border-b border-[#141414] bg-white/50">
          <div className="p-2.5 border-r border-[#141414]">
            <MetadataInput label="착공일" value={metadata.commencementDate} field="commencementDate" placeholder="202X.XX.XX" />
          </div>
          <div className="p-2.5 border-r border-[#141414]">
            <MetadataInput label="준공일" value={metadata.completionDate} field="completionDate" placeholder="202X.XX.XX" />
          </div>
          <div className="p-2.5 border-r border-[#141414]">
            <MetadataInput label="동수" value={metadata.buildingCount} field="buildingCount" placeholder="00개동" />
          </div>
          <div className="p-2.5 border-r border-[#141414]">
            <MetadataInput label="세대수" value={metadata.householdCount} field="householdCount" placeholder="000세대" />
          </div>
          <div className="p-2.5 border-r border-[#141414]">
            <MetadataInput label="최상층" value={metadata.highestFloor} field="highestFloor" placeholder="B0 / 00F" />
          </div>
          <div className="p-2.5 flex items-center justify-between">
            <MetadataInput label="최하층" value={metadata.lowestFloor} field="lowestFloor" placeholder="B0 / 00F" />
            
            {/* Method Toggle in HD Header */}
            <button
              onClick={() => onUpdateSeparationMethod?.(separationMethod === 'method1' ? 'method2' : 'method1')}
              className={`ml-2 px-1.5 py-0.5 border border-black text-[9px] font-black uppercase flex items-center gap-1 transition-colors ${
                separationMethod === 'method2' ? 'bg-yellow-400 text-black' : 'bg-white text-slate-500'
              }`}
              title="분리 방식 전환: 방식1(표준) vs 방식2(공정분리/외주턴키)"
            >
              <Workflow size={10} />
              {separationMethod === 'method2' ? '공정분리방식 (B2)' : '표준분리방식 (B1)'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-[#141414]">
          <div className="p-3.5 border-r border-b lg:border-b-0 border-[#141414] flex flex-col justify-between bg-white">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase opacity-60 font-black mb-1">총 계약 합계 금액 (TOTAL)</span>
              <span className="text-xl lg:text-2xl font-mono leading-none tracking-tighter italic font-black text-indigo-950">
                ₩{totalContractAmount.toLocaleString()}
              </span>

              {/* 안전장비류 별도 표기 */}
              <div className="mt-2 flex items-center justify-between px-2 py-1 bg-amber-50/80 rounded border border-amber-200">
                <span className="text-[9px] font-black text-amber-900 flex items-center gap-1">
                  <Shield size={10} className="text-amber-700" />
                  [별도] 안전장비류
                </span>
                <span className="text-xs font-mono font-black text-amber-950">
                  ₩{costBreakdown.safetyEquipmentCost.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="mt-3 pt-2 border-t border-[#141414]/10 grid grid-cols-1 gap-2">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">재료(직접) / 노무 / 외주</span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold leading-none">
                  <span className="text-blue-600">₩{costBreakdown.materialCost.toLocaleString()}</span>
                  <span className="opacity-20">/</span>
                  <span className="text-amber-600">₩{costBreakdown.laborCost.toLocaleString()}</span>
                  <span className="opacity-20">/</span>
                  <span className="text-indigo-600">₩{costBreakdown.outsourcingCost.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">간접비 / 지급자재</span>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold leading-none">
                  <span className="text-orange-600">₩{costBreakdown.indirectCost.toLocaleString()}</span>
                  <span className="opacity-20">/</span>
                  <span className="text-emerald-600 font-black">₩{costBreakdown.clientSuppliedCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-3.5 border-r lg:border-r border-b lg:border-b-0 border-[#141414] flex flex-col justify-between">
            <span className="text-[10px] uppercase opacity-60 font-black mb-1">분리된 공정 수</span>
            <span className="text-xl lg:text-2xl font-mono leading-none italic font-bold">
              {Object.keys(categoryTotals).length} <small className="text-xs opacity-50 font-normal">Categories</small>
            </span>
            <div className="mt-2 text-[10px] text-slate-500 font-mono">
              재료비 {materialPercent.toFixed(0)}% / 외주 {laborPercent.toFixed(0)}%
            </div>
          </div>
          <div className="p-3.5 border-r border-[#141414] flex flex-col justify-between">
            <span className="text-[10px] uppercase opacity-60 font-black mb-1">분석 완료 품목</span>
            <span className="text-xl lg:text-2xl font-mono leading-none text-blue-700 italic font-black">
              {items.length} <small className="text-xs font-normal opacity-60">Items</small>
            </span>
            <div className="mt-2 text-[10px] text-slate-500 font-mono">
              분류 품목: {classifiedItems.length}건
            </div>
          </div>
          <div className="p-3.5 flex flex-col justify-between bg-white relative group cursor-pointer overflow-hidden border-b lg:border-b-0 border-[#141414]" onClick={onOpenSectionSummary}>
            <div className="absolute inset-0 bg-yellow-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
            <div className="relative z-10">
              <span className="text-[10px] uppercase opacity-60 font-black mb-1 group-hover:text-black">공정 상세 분석 리포트</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-black uppercase text-indigo-600 group-hover:text-black">OPEN_REPORT</span>
                <LayoutGrid size={16} className="group-hover:rotate-90 transition-transform text-indigo-400 group-hover:text-black" />
              </div>
            </div>
            <div className="relative z-10 text-[10px] opacity-60 group-hover:text-black font-mono">
              층별/구간별 매트릭스
            </div>
          </div>
        </div>
        
        {/* Category breakdown row for High Density */}
        <div className="flex overflow-x-auto bg-white/40 backdrop-blur-xs divide-x divide-[#141414]">
          {chartData.slice(0, 8).map((cat) => (
            <div key={cat.name} className="flex-1 min-w-[170px] p-2.5 flex flex-col justify-between hover:bg-white transition-colors">
              <span className="text-[10px] font-bold text-slate-600 truncate mb-1 uppercase tracking-tight">
                {cat.name === '외주' ? '🛠️ 외주 (외주비)' : cat.name}
              </span>
              <div className="flex items-end justify-between">
                <span className="text-xs font-mono font-bold italic">₩{cat.value.toLocaleString()}</span>
                <span className="text-[10px] font-black text-indigo-600">
                  {totalContractAmount > 0 ? ((cat.value / totalContractAmount) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
      {/* Project Info Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">현장 개요 (Site Spec)</h3>
          </div>
          
          {/* Method Toggle in Standard Dashboard */}
          <button
            onClick={() => onUpdateSeparationMethod?.(separationMethod === 'method1' ? 'method2' : 'method1')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
              separationMethod === 'method2' 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100' 
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Workflow size={12} />
            {separationMethod === 'method2' ? '공정분리방식 ON' : '표준분리방식'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <MetadataInput label="착공일" value={metadata.commencementDate} field="commencementDate" placeholder="202X.XX.XX" />
          <MetadataInput label="준공일" value={metadata.completionDate} field="completionDate" placeholder="202X.XX.XX" />
          <MetadataInput label="동수" value={metadata.buildingCount} field="buildingCount" placeholder="0개동" />
          <MetadataInput label="세대수" value={metadata.householdCount} field="householdCount" placeholder="0세대" />
          <MetadataInput label="최상층" value={metadata.highestFloor} field="highestFloor" placeholder="지상 00층" />
          <MetadataInput label="최하층" value={metadata.lowestFloor} field="lowestFloor" placeholder="지하 0층" />
        </div>
      </div>

      {/* Summary Card with Material / Outsourcing split */}
      <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-700">총 계약 합계 금액</span>
            </div>
            <button 
              onClick={onOpenSectionSummary}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 shadow-2xs"
            >
              공정 분석 <ArrowRight size={12} />
            </button>
          </div>
          <div className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
            ₩{totalContractAmount.toLocaleString()}
          </div>

          {/* 안전장비류 별도 표기 */}
          <div className="mt-2.5 flex items-center justify-between px-3 py-2 bg-amber-50/90 rounded-xl border border-amber-200/80">
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-amber-600" />
              <span className="text-xs font-black text-amber-900 uppercase tracking-tight">[별도] 안전장비류</span>
            </div>
            <span className="text-sm font-mono font-black text-amber-950">
              ₩{costBreakdown.safetyEquipmentCost.toLocaleString()}
            </span>
          </div>

          {/* Detailed Cost Breakdown */}
          <div className="mt-4 space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">재료비 (직접자재)</span>
                <span className="text-[11px] font-bold text-blue-600 font-mono">₩{costBreakdown.materialCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">노무비</span>
                <span className="text-[11px] font-bold text-amber-600 font-mono">₩{costBreakdown.laborCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                  {separationMethod === 'method2' ? '외주비 (자재+노무 일괄)' : '외주 노무비'}
                </span>
                <span className="text-[11px] font-bold text-indigo-600 font-mono">₩{costBreakdown.outsourcingCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">간접비</span>
                <span className="text-[11px] font-bold text-orange-600 font-mono">₩{costBreakdown.indirectCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5 col-span-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">지급자재</span>
                <span className="text-[11px] font-black text-emerald-600 font-mono">₩{costBreakdown.clientSuppliedCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <p className="text-slate-500 leading-snug">
              현재 <span className="font-bold text-indigo-700">{separationMethod === 'method2' ? '방식2: 공정분리/외주턴키' : '방식1: 표준분리'}</span> 정산 방식이 적용 중입니다.
            </p>
          </div>
        </div>
      </div>

      {/* Bar Chart Card */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">공종별 금액 분포 (외주비 포함)</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium font-mono">
            {chartData.length} Categories
          </span>
        </div>
        
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                dy={8}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)' }}
                formatter={(value: number) => [`₩${value.toLocaleString()}`, '금액']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === '외주' ? '#F59E0B' : colors[index % colors.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

