import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeftRight, TrendingUp, TrendingDown, Minus, BarChart3, PieChart } from 'lucide-react';
import { Project, SpecItem, ThemeType } from '../types';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  getItemContractAmount 
} from '../utils/costCalculation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  theme: ThemeType | null;
}

export default function ProjectComparisonModal({ onClose, projects, theme }: Omit<Props, 'isOpen'>) {
  const [projectAId, setProjectAId] = useState<string>('');
  const [projectBId, setProjectBId] = useState<string>('');

  const projectA = projects.find(p => p.id === projectAId);
  const projectB = projects.find(p => p.id === projectBId);

  const calculateStats = (items: SpecItem[]) => {
    const total = items.reduce((sum, item) => sum + getItemContractAmount(item), 0);
    const material = items.reduce((sum, item) => sum + getItemMaterialCost(item), 0);
    const labor = items.reduce((sum, item) => sum + getItemLaborCost(item), 0);
    
    const categoryBreakdown: Record<string, number> = {};
    items.forEach(item => {
      const cat = item.category || '미분류';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + getItemContractAmount(item);
    });

    return { total, material, labor, categoryBreakdown };
  };

  const statsA = useMemo(() => projectA ? calculateStats(projectA.items) : null, [projectA]);
  const statsB = useMemo(() => projectB ? calculateStats(projectB.items) : null, [projectB]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    if (statsA) Object.keys(statsA.categoryBreakdown).forEach(c => cats.add(c));
    if (statsB) Object.keys(statsB.categoryBreakdown).forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [statsA, statsB]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(price));
  };

  const getDiffPercent = (valA: number, valB: number) => {
    if (valA === 0) return 0;
    return ((valB - valA) / valA) * 100;
  };

  const renderDiff = (valA: number, valB: number) => {
    const diff = valB - valA;
    const percent = getDiffPercent(valA, valB);
    
    if (diff === 0) return <span className="text-slate-400 flex items-center gap-1 text-[10px]"><Minus size={10} /> 0%</span>;
    
    const isIncrease = diff > 0;
    return (
      <span className={`flex items-center gap-1 text-[10px] font-bold ${isIncrease ? 'text-red-500' : 'text-blue-500'}`}>
        {isIncrease ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {isIncrease ? '+' : ''}{percent.toFixed(1)}%
      </span>
    );
  };

  const isHighDensity = theme === 'high-density';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl ${isHighDensity ? 'bg-[#141414] text-white border border-[#333]' : 'bg-white rounded-3xl'}`}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isHighDensity ? 'border-[#333]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isHighDensity ? 'bg-white/10' : 'bg-indigo-50 text-indigo-600'}`}>
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">현장 데이터 비교분석</h2>
              <p className={`text-xs ${isHighDensity ? 'text-slate-400' : 'text-slate-500'}`}>두 개 현장의 내역 구성 및 비용 차이를 한눈에 비교합니다.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isHighDensity ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Project Selection Area */}
        <div className={`px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b ${isHighDensity ? 'border-[#333] bg-[#1a1a1a]' : 'border-slate-50 bg-slate-50/50'}`}>
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-wider ${isHighDensity ? 'text-slate-500' : 'text-slate-400'}`}>비교 대상 현장 A</label>
            <select 
              value={projectAId}
              onChange={(e) => setProjectAId(e.target.value)}
              className={`w-full px-4 py-2.5 text-sm font-bold border outline-none transition-all ${isHighDensity ? 'bg-[#141414] border-[#333] rounded-none focus:border-indigo-500' : 'bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'}`}
            >
              <option value="">현장 선택...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-wider ${isHighDensity ? 'text-slate-500' : 'text-slate-400'}`}>비교 대상 현장 B</label>
            <select 
              value={projectBId}
              onChange={(e) => setProjectBId(e.target.value)}
              className={`w-full px-4 py-2.5 text-sm font-bold border outline-none transition-all ${isHighDensity ? 'bg-[#141414] border-[#333] rounded-none focus:border-indigo-500' : 'bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'}`}
            >
              <option value="">현장 선택...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Content */}
        <div className="flex-grow overflow-y-auto p-6 space-y-8">
          {(!projectA || !projectB) ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isHighDensity ? 'bg-white/5' : 'bg-slate-50'}`}>
                <BarChart3 size={32} className="text-slate-300" />
              </div>
              <p className={`text-sm font-medium ${isHighDensity ? 'text-slate-400' : 'text-slate-500'}`}>비교할 두 개의 현장을 상단에서 선택해주세요.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-5 border ${isHighDensity ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-slate-100 rounded-2xl shadow-sm'}`}>
                  <p className={`text-[10px] font-black uppercase mb-3 ${isHighDensity ? 'text-slate-500' : 'text-slate-400'}`}>총 실행 예산 비교</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">A: {projectA.name}</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsA!.total)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">B: {projectB.name}</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsB!.total)}</span>
                    </div>
                    <div className={`pt-2 border-t flex justify-between items-center ${isHighDensity ? 'border-[#333]' : 'border-slate-50'}`}>
                      <span className="text-[10px] font-bold">증감분</span>
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-black ${statsB!.total - statsA!.total > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {statsB!.total - statsA!.total > 0 ? '+' : ''}{formatPrice(statsB!.total - statsA!.total)}
                        </span>
                        {renderDiff(statsA!.total, statsB!.total)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-5 border ${isHighDensity ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-slate-100 rounded-2xl shadow-sm'}`}>
                  <p className={`text-[10px] font-black uppercase mb-3 ${isHighDensity ? 'text-slate-500' : 'text-slate-400'}`}>자재비/재료비 합계</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">A</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsA!.material)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">B</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsB!.material)}</span>
                    </div>
                    <div className={`pt-2 border-t flex justify-between items-center ${isHighDensity ? 'border-[#333]' : 'border-slate-50'}`}>
                      <span className="text-[10px] font-bold">차이</span>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-600">
                          {formatPrice(Math.abs(statsB!.material - statsA!.material))}
                        </span>
                        {renderDiff(statsA!.material, statsB!.material)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-5 border ${isHighDensity ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-slate-100 rounded-2xl shadow-sm'}`}>
                  <p className={`text-[10px] font-black uppercase mb-3 ${isHighDensity ? 'text-slate-500' : 'text-slate-400'}`}>노무비 합계</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">A</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsA!.labor)}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-slate-500">B</span>
                      <span className="text-sm font-bold">₩{formatPrice(statsB!.labor)}</span>
                    </div>
                    <div className={`pt-2 border-t flex justify-between items-center ${isHighDensity ? 'border-[#333]' : 'border-slate-50'}`}>
                      <span className="text-[10px] font-bold">차이</span>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-600">
                          {formatPrice(Math.abs(statsB!.labor - statsA!.labor))}
                        </span>
                        {renderDiff(statsA!.labor, statsB!.labor)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category-wise Table Comparison */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <PieChart size={16} className="text-indigo-500" />
                  <h3 className="text-sm font-black tracking-tight uppercase">공종별(카테고리) 상세 비교</h3>
                </div>
                
                <div className={`border overflow-hidden ${isHighDensity ? 'border-[#333] bg-[#1a1a1a]' : 'border-slate-100 rounded-2xl bg-white shadow-sm'}`}>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className={`${isHighDensity ? 'bg-white/5' : 'bg-slate-50/50'} border-b ${isHighDensity ? 'border-[#333]' : 'border-slate-100'}`}>
                        <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider">공종 카테고리</th>
                        <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider text-right">A 현장</th>
                        <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider text-right">B 현장</th>
                        <th className="px-4 py-3 font-black text-slate-500 uppercase tracking-wider text-right">변동/차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCategories.map(cat => {
                        const valA = statsA!.categoryBreakdown[cat] || 0;
                        const valB = statsB!.categoryBreakdown[cat] || 0;
                        return (
                          <tr key={cat} className={`border-b last:border-0 ${isHighDensity ? 'border-[#333] hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50/30'}`}>
                            <td className="px-4 py-3 font-bold">{cat}</td>
                            <td className="px-4 py-3 text-right">₩{formatPrice(valA)}</td>
                            <td className="px-4 py-3 text-right font-bold">₩{formatPrice(valB)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-black ${valB - valA > 0 ? 'text-red-500' : valB - valA < 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                                  {valB - valA > 0 ? '+' : ''}{formatPrice(valB - valA)}
                                </span>
                                {renderDiff(valA, valB)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end ${isHighDensity ? 'border-[#333] bg-[#1a1a1a]' : 'border-slate-50 bg-slate-50/50'}`}>
          <button 
            onClick={onClose}
            className={`px-6 py-2 text-xs font-bold transition-all rounded-xl ${isHighDensity ? 'bg-white text-black hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            확인 및 닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
