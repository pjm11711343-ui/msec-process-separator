import React, { useMemo } from 'react';
import { SpecItem, ThemeType } from '../types';
import { TrendingDown, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { getItemQuantity } from '../utils/costCalculation';

interface Props {
  items: SpecItem[];
  theme: ThemeType;
}

interface PriceGroup {
  name: string;
  specification: string;
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  variancePercent: number;
  relatedItems: SpecItem[];
}

export default function PriceAnalysis({ items, theme }: Props) {
  const analysisData = useMemo(() => {
    const groups: Record<string, SpecItem[]> = {};

    items.forEach(item => {
      const key = `${item.name}|${item.specification}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const results: PriceGroup[] = Object.values(groups)
      .map(groupItems => {
        const prices = groupItems.map(i => i.unitPrice);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variancePercent = minPrice === 0 ? 0 : ((maxPrice - minPrice) / minPrice) * 100;

        return {
          name: groupItems[0].name,
          specification: groupItems[0].specification,
          count: groupItems.length,
          minPrice,
          maxPrice,
          avgPrice,
          variancePercent,
          relatedItems: groupItems
        };
      })
      .filter(group => group.count > 1 && group.minPrice !== group.maxPrice)
      .sort((a, b) => b.variancePercent - a.variancePercent);

    return results;
  }, [items]);

  const themeStyles = {
    industrial: {
      card: 'bg-slate-900 border-slate-800 text-slate-300',
      header: 'text-slate-100',
      highlight: 'bg-red-950/30 text-red-400 border-red-900/50'
    },
    modern: {
      card: 'bg-white border-slate-200 text-slate-700 shadow-sm',
      header: 'text-slate-900',
      highlight: 'bg-red-50 text-red-600 border-red-100'
    },
    minimal: {
      card: 'bg-white border-zinc-200 text-zinc-900',
      header: 'text-zinc-900',
      highlight: 'bg-zinc-50 border-zinc-200'
    },
    'high-density': {
      card: 'bg-white border-[#141414] text-[#141414]',
      header: 'text-[#141414] font-black uppercase tracking-tighter',
      highlight: 'bg-[#FF0000]/10 border-[#141414]'
    }
  }[theme];

  if (analysisData.length === 0) {
    return (
      <div className={`p-12 text-center rounded-2xl border-2 border-dashed ${theme === 'industrial' ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
        <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-bold mb-1">분석할 데이터가 부족합니다</h3>
        <p className="text-sm">동일한 품명/규격을 가졌으나 단가가 다른 항목이 현재 내역에 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl lg:text-2xl font-bold ${themeStyles.header}`}>단가 변동성 분석 보고서</h2>
          <p className={`text-sm opacity-60 mt-1`}>동일 품목 간의 단가 차이를 분석하여 이상 징후를 감지합니다.</p>
        </div>
        <div className={`shrink-0 px-4 py-2 rounded-full border ${themeStyles.card} flex items-center gap-2`}>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-500 whitespace-nowrap">주의 항목: {analysisData.filter(d => d.variancePercent > 10).length}건</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {analysisData.map((group, idx) => {
          const isHighVariance = group.variancePercent > 10;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={`${group.name}-${group.specification}`}
              className={`border-l-4 p-4 lg:p-5 rounded-r-xl ${themeStyles.card} ${
                isHighVariance ? 'border-l-red-500' : 'border-l-indigo-500'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isHighVariance ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isHighVariance ? '주의' : '정상'}
                    </span>
                    <h3 className="font-bold text-base lg:text-lg truncate">{group.name}</h3>
                  </div>
                  <p className="text-sm opacity-60 tracking-tight truncate">{group.specification}</p>
                </div>

                <div className="flex flex-row items-center justify-between lg:justify-end gap-4 lg:gap-8 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                  <div className="text-right">
                    <p className="text-[9px] lg:text-[10px] uppercase font-bold opacity-50 mb-1">가격 범위</p>
                    <div className="flex items-center gap-2 lg:justify-end">
                      <span className="font-mono text-xs lg:text-sm whitespace-nowrap">₩{group.minPrice.toLocaleString()}</span>
                      <div className="hidden sm:block w-8 lg:w-12 h-1 bg-slate-200 rounded-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500 opacity-20"></div>
                      </div>
                      <span className="font-mono text-xs lg:text-sm font-bold whitespace-nowrap">₩{group.maxPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-right border-l pl-4 lg:pl-8 border-slate-200">
                    <p className="text-[9px] lg:text-[10px] uppercase font-bold opacity-50 mb-1">변동성 (%)</p>
                    <div className={`flex items-center gap-1 lg:justify-end font-mono text-lg lg:text-xl font-black ${
                      isHighVariance ? 'text-red-500' : 'text-indigo-500'
                    }`}>
                      {isHighVariance ? <TrendingUp size={16} className="lg:w-5 lg:h-5" /> : <TrendingDown size={16} className="lg:w-5 lg:h-5" />}
                      {group.variancePercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                <p className="text-[9px] font-bold uppercase opacity-40 mb-2">상세 내역 ({group.count}개 공종)</p>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-[11px] lg:text-xs min-w-[500px]">
                    <thead>
                      <tr className="opacity-50 border-b border-slate-100">
                        <th className="text-left py-2 font-medium">공종 (Section)</th>
                        <th className="text-center py-2 font-medium">단위</th>
                        <th className="text-right py-2 font-medium">수량</th>
                        <th className="text-right py-2 font-medium">단가</th>
                        <th className="text-right py-2 font-medium text-indigo-500">평균가 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.relatedItems.map(item => {
                        const diffPercent = ((item.unitPrice - group.avgPrice) / group.avgPrice) * 100;
                        return (
                          <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="py-2 opacity-80">{item.section}</td>
                            <td className="py-2 text-center opacity-60">{item.unit}</td>
                            <td className="py-2 text-right font-mono">{getItemQuantity(item).toLocaleString()}</td>
                            <td className="py-2 text-right font-mono font-bold">₩{item.unitPrice.toLocaleString()}</td>
                            <td className={`py-2 text-right font-mono font-bold ${
                              diffPercent > 0 ? 'text-red-500' : 'text-blue-500'
                            }`}>
                              {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
