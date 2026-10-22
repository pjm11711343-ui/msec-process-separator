import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { motion } from 'motion/react';
import { LayoutGrid, PieChart as PieChartIcon, ArrowUpRight, Calculator, X } from 'lucide-react';
import { getItemMaterialCost, getItemLaborCost, getItemContractAmount, isSafetyEquipmentItem } from '../utils/costCalculation';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
  onClose?: () => void;
}

export default function SectionSummaryCards({ items, theme, onClose }: Props) {
  if (!items || items.length === 0) return null;

  // Helper to calculate category amount without labor costs (노무비/외주비/간접비/지급자재 제외한 순수 재료비/자재비 합산)
  const getItemCategoryAmount = (item: SpecItem): number => {
    return getItemMaterialCost(item);
  };

  const sections = [...new Set(items.map(item => item.section || '기타 공정'))].sort();
  const totalProjectAmount = items.reduce((sum, item) => sum + getItemContractAmount(item), 0);

  const sectionData = sections.map(sectionName => {
    const sectionItems = items.filter(i => (i.section || '기타 공정') === sectionName);
    const totalAmount = sectionItems.reduce((sum, i) => sum + getItemContractAmount(i), 0);
    
    // Group by category within this section (Split labor to '간접비')
    const categoryBreakdown = sectionItems.reduce((acc, item) => {
      const itemCat = item.category || '기타';
      const matAmt = getItemMaterialCost(item);
      const labAmt = getItemLaborCost(item); // Note: I need to import getItemLaborCost or use it if available
      
      const isSpecial = itemCat.includes('외주') || itemCat.includes('간접') || itemCat.includes('지급자재');

      if (isSpecial) {
        acc[itemCat] = (acc[itemCat] || 0) + matAmt + labAmt;
      } else {
        // Material stays in original category
        if (matAmt > 0) {
          acc[itemCat] = (acc[itemCat] || 0) + matAmt;
        }
        // Labor moves to '간접비'
        if (labAmt > 0) {
          const indirectCat = '간접비';
          acc[indirectCat] = (acc[indirectCat] || 0) + labAmt;
        }
      }
      
      return acc;
    }, {} as Record<string, number>);

    return {
      name: sectionName,
      totalAmount,
      percentage: totalProjectAmount > 0 ? (totalAmount / totalProjectAmount) * 100 : 0,
      categoryBreakdown: Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]),
      itemCount: sectionItems.length
    };
  });

  const content = (
    <div className={onClose ? "max-h-[85vh] overflow-y-auto p-1" : ""}>
      {theme === 'high-density' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 border border-[#141414] bg-[#EBEAE8]">
          <div className="col-span-full bg-[#141414] text-white px-4 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
              <LayoutGrid size={12} />
              공정별 예산 배분 상세 요약 (Section Analysis)
            </span>
            <span className="text-[11px] opacity-60">Total: ₩{totalProjectAmount.toLocaleString()}</span>
          </div>
          {sectionData.map((section, idx) => (
            <div key={section.name} className={`p-3 border-r border-b border-[#141414] flex flex-col bg-white hover:bg-[#F9F9F9] transition-colors`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-600 uppercase mb-0.5">SECTION {idx + 1}</span>
                  <h4 className="text-[11px] font-bold leading-tight truncate max-w-[200px]" title={section.name}>
                    {section.name}
                  </h4>
                </div>
                <span className="text-[11px] font-mono font-black italic bg-amber-100 px-1 border border-amber-200">
                  {section.percentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="mb-3">
                <div className="text-lg font-mono font-black tracking-tighter leading-none mb-1">
                  ₩{section.totalAmount.toLocaleString()}
                </div>
                <div className="text-[11px] uppercase font-bold opacity-40">총 할당 예산 (Total Allocation)</div>
              </div>
              
              <div className="space-y-1.5 mt-auto">
                <div className="flex justify-between items-center bg-[#F2F2F2] px-1.5 py-0.5 border-l-2 border-[#141414]">
                  <span className="text-[11px] font-black uppercase">분류별 배분 (Category Split)</span>
                  <span className="text-[11px] font-mono">{section.itemCount} items</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {section.categoryBreakdown.slice(0, 4).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center text-[11px]">
                      <span className="truncate max-w-[120px] font-medium opacity-70">{cat}</span>
                      <span className="font-mono font-bold">₩{amt.toLocaleString()}</span>
                    </div>
                  ))}
                  {section.categoryBreakdown.length > 4 && (
                    <div className="text-[11px] italic text-center opacity-40 border-t border-dashed border-gray-300 pt-1">
                      외 {section.categoryBreakdown.length - 4}개 카테고리가 더 존재함
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Calculator size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">공정별 예산 요약</h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <PieChartIcon size={14} />
              <span>공정별 전체 대비 비중 확인 가능</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {sectionData.map((section, idx) => (
              <motion.div
                key={section.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden"
              >
                {/* Background Decorative Accent */}
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                  <ArrowUpRight size={80} />
                </div>

                <div className="flex justify-between items-start mb-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                    Section {idx + 1}
                  </span>
                  <span className="text-lg font-bold text-indigo-600">
                    {section.percentage.toFixed(1)}%
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1 truncate" title={section.name}>
                  {section.name}
                </h3>
                <div className="text-2xl font-black text-slate-900 mb-6">
                  ₩{section.totalAmount.toLocaleString()}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-tight">
                    <span>주요 카테고리별 비중</span>
                    <span>{section.itemCount} 품목</span>
                  </div>
                  <div className="space-y-2">
                    {section.categoryBreakdown.slice(0, 3).map(([cat, amt]) => (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-600">{cat}</span>
                          <span className="text-slate-900 font-bold">₩{amt.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: `${(amt / section.totalAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {section.categoryBreakdown.length > 3 && (
                    <p className="text-[11px] text-slate-400 text-center pt-2">
                      외 {section.categoryBreakdown.length - 3}개의 자재 분류가 포함되어 있습니다.
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (!onClose) return <div className="mb-10">{content}</div>;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={`w-full max-w-6xl overflow-hidden shadow-2xl relative ${theme === 'high-density' ? 'bg-[#E7E6E1] border-2 border-[#141414] rounded-none' : 'bg-slate-50 border border-slate-200 rounded-2xl'}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'high-density' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <LayoutGrid size={20} />
            <h3 className={`text-lg font-bold tracking-tight ${theme === 'high-density' ? 'uppercase font-black' : ''}`}>
              공정별 예산 배분 상세 요약
            </h3>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 transition-all ${theme === 'high-density' ? 'bg-white text-black hover:bg-yellow-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full'}`}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {content}
        </div>
        <div className={`px-6 py-4 border-t flex justify-end ${theme === 'high-density' ? 'bg-[#F2F2F2] border-[#141414]' : 'bg-white border-slate-200'}`}>
           <button 
             onClick={onClose}
             className={`px-6 py-2 font-bold transition-all ${theme === 'high-density' ? 'bg-[#141414] text-white hover:bg-black uppercase text-xs' : 'bg-slate-900 text-white rounded-lg hover:bg-slate-800'}`}
           >
             창 닫기
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
