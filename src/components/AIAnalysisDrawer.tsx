import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cpu, Sparkles, BarChart3, Download, Zap, Brain, TrendingUp, AlertCircle, PieChart } from 'lucide-react';
import { SpecItem, ThemeType } from '../types';
import PriceAnalysis from './PriceAnalysis';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: SpecItem[];
  theme: ThemeType;
  onExportXlsx?: () => void;
}

export default function AIAnalysisDrawer({ isOpen, onClose, items, theme, onExportXlsx }: Props) {
  const [view, setView] = React.useState<'menu' | 'report'>('menu');

  // Reset view to menu when drawer closes
  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setView('menu'), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const isHighDensity = theme === 'high-density';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bottom-0 left-0 right-0 z-[201] flex flex-col max-h-[92vh] ${
              isHighDensity 
                ? 'bg-[#E7E6E1] border-t-4 border-[#141414]' 
                : 'bg-white rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] border-t border-slate-200'
            }`}
          >
            {/* Handle for mobile feel */}
            {!isHighDensity && (
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2" />
            )}

            {/* Header */}
            <div className={`px-8 py-6 flex items-center justify-between ${isHighDensity ? 'bg-[#141414] text-white' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-2xl ${isHighDensity ? 'bg-blue-500' : 'bg-indigo-600 text-white'}`}>
                  <Brain size={24} className={isHighDensity ? 'text-white' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-xl font-black tracking-tight ${isHighDensity ? 'uppercase' : 'text-slate-900'}`}>
                      Semantic AI Analysis
                    </h2>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${isHighDensity ? 'bg-yellow-400 text-black' : 'bg-indigo-100 text-indigo-700'}`}>
                      v4.2 PRO
                    </span>
                  </div>
                  <p className={`text-xs font-medium opacity-60 ${isHighDensity ? '' : 'text-slate-500'}`}>
                    기계설비 공정 내역서 지능형 단가 분석 및 시스템 진단
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className={`p-2.5 transition-all ${
                  isHighDensity 
                    ? 'hover:bg-white/10 rounded-full' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full'
                }`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
              {view === 'menu' ? (
                <div className="max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Diagnostic Card */}
                    <button
                      onClick={() => setView('report')}
                      className={`group p-6 text-left border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isHighDensity 
                          ? 'border-[#141414] bg-white hover:bg-zinc-50' 
                          : 'border-slate-100 bg-white rounded-3xl hover:border-indigo-200 hover:shadow-xl shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl ${isHighDensity ? 'bg-[#141414] text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                          <Sparkles size={24} />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-full">
                          <Zap size={10} /> Active
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">전체 시스템 AI 진단</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        내역서 전체 항목의 단가 분포와 카테고리 분류 정합성을 AI 알고리즘으로 전수 조사합니다.
                      </p>
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                        진단 시작하기 <TrendingUp size={14} />
                      </div>
                    </button>

                    {/* Price Analysis Card */}
                    <button
                      onClick={() => setView('report')}
                      className={`group p-6 text-left border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isHighDensity 
                          ? 'border-[#141414] bg-white hover:bg-zinc-50' 
                          : 'border-slate-100 bg-white rounded-3xl hover:border-indigo-200 hover:shadow-xl shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-2xl ${isHighDensity ? 'bg-[#141414] text-white' : 'bg-amber-50 text-amber-600'}`}>
                          <BarChart3 size={24} />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">가격 분포 및 이상치 탐색</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-6">
                        카테고리별 단가 편차를 분석하여 평균 범위를 벗어난 이상 항목을 시각화합니다.
                      </p>
                      <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                        리포트 열기 <PieChart size={14} />
                      </div>
                    </button>

                    {/* Export Card */}
                    <button
                      onClick={onExportXlsx}
                      className={`group p-6 text-left border-2 transition-all hover:scale-[1.02] active:scale-[0.98] md:col-span-2 ${
                        isHighDensity 
                          ? 'border-[#141414] bg-[#141414] text-white hover:bg-black' 
                          : 'border-slate-100 bg-slate-900 text-white rounded-3xl hover:shadow-xl'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl bg-white/10 text-white`}>
                            <Download size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">분석 보고서 엑셀 출력</h3>
                            <p className="text-sm opacity-60">AI 분석 결과가 포함된 공정분리 보고서를 다운로드합니다.</p>
                          </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl font-bold text-xs uppercase ${isHighDensity ? 'bg-yellow-400 text-black' : 'bg-white text-slate-900'}`}>
                          Download XLSX
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* System Info Footnote */}
                  <div className="mt-12 flex items-center gap-2 justify-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <AlertCircle size={12} />
                    Data processing powered by Antigravity Reasoning Engine
                  </div>
                </div>
              ) : (
                <div className="max-w-6xl mx-auto">
                  <div className="mb-6 flex items-center justify-between">
                    <button 
                      onClick={() => setView('menu')}
                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"
                    >
                      <X size={14} /> 진단 종료 및 메뉴로 돌아가기
                    </button>
                    <div className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      Report ID: ANA-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                    </div>
                  </div>
                  <PriceAnalysis items={items} theme={theme} />
                </div>
              )}
            </div>

            {/* Footer / Drag Area */}
            <div className={`px-8 py-4 border-t flex justify-center ${isHighDensity ? 'bg-[#F2F2F2] border-[#141414]' : 'bg-slate-50'}`}>
              <div className="w-16 h-1 bg-slate-300 rounded-full opacity-50" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
