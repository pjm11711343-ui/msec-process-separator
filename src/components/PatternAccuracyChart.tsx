import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Sliders, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  RotateCcw,
  Target,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
  Eye,
  Info,
  Trash2,
  Edit2
} from 'lucide-react';
import { CustomClassificationRule, SpecItem } from '../types';
import { calculatePatternStats, isLowSuccessRule } from '../utils/patternAnalytics';

interface Props {
  customRules: CustomClassificationRule[];
  items: SpecItem[];
  onSelectRuleForEdit?: (ruleId: string) => void;
  onResetRuleStats?: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
}

export default function PatternAccuracyChart({
  customRules = [],
  items = [],
  onSelectRuleForEdit,
  onResetRuleStats,
  onDeleteRule
}: Props) {
  const [viewMode, setViewMode] = useState<'bar' | 'pie' | 'table'>('bar');
  const [sortBy, setSortBy] = useState<'failureRate' | 'successRate' | 'evaluations'>('failureRate');
  const [metricType, setMetricType] = useState<'count' | 'percentage'>('count');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [filterLowSuccessOnly, setFilterLowSuccessOnly] = useState(false);

  // Compute pattern statistics
  const { patternStats, overall } = useMemo(() => {
    return calculatePatternStats(customRules, items);
  }, [customRules, items]);

  // Filter and sort for display
  const displayStats = useMemo(() => {
    let list = [...patternStats];
    if (filterActiveOnly) {
      list = list.filter(p => p.isEnabled);
    }
    if (filterLowSuccessOnly) {
      list = list.filter(p => isLowSuccessRule(p));
    }

    list.sort((a, b) => {
      if (sortBy === 'failureRate') {
        if (b.failureRate !== a.failureRate) return b.failureRate - a.failureRate;
        return b.totalFailure - a.totalFailure;
      }
      if (sortBy === 'successRate') {
        if (b.successRate !== a.successRate) return b.successRate - a.successRate;
        return b.totalSuccess - a.totalSuccess;
      }
      return b.totalEvaluations - a.totalEvaluations;
    });

    return list;
  }, [patternStats, filterActiveOnly, filterLowSuccessOnly, sortBy]);

  // Data format for Recharts BarChart
  const barChartData = useMemo(() => {
    return displayStats.slice(0, 15).map(stat => ({
      name: stat.pattern.length > 8 ? stat.pattern.substring(0, 8) + '…' : stat.pattern,
      fullName: stat.pattern,
      category: stat.category,
      successCount: stat.totalSuccess,
      failureCount: stat.totalFailure,
      successRate: stat.successRate,
      failureRate: stat.failureRate,
      total: stat.totalEvaluations,
      mismatches: stat.mismatchedItems.length,
      // For percentage stacked chart
      successPct: stat.totalEvaluations > 0 ? stat.successRate : 100,
      failurePct: stat.totalEvaluations > 0 ? stat.failureRate : 0,
    }));
  }, [displayStats]);

  // Data format for Overall Pie Chart
  const pieChartData = useMemo(() => {
    return [
      { name: '분류 성공 (일치/유지)', value: overall.totalSuccess, color: '#10b981' },
      { name: '분류 실패 (오분류/재분류)', value: overall.totalFailure, color: '#f43f5e' }
    ].filter(d => d.value > 0);
  }, [overall]);

  const customTooltipFormatter = (value: any, name: any, item: any) => {
    const payload = item?.payload;
    if (!payload) return [value, name];
    if (name === '성공 (유지/일치)' || name === '성공률 (%)') {
      return [`${payload.successCount}건 (${payload.successRate}%)`, '성공 (유지/일치)'];
    }
    if (name === '실패 (오분류/재분류)' || name === '실패율 (%)') {
      return [`${payload.failureCount}건 (${payload.failureRate}%)`, '실패 (오분류/재분류)'];
    }
    return [value, name];
  };

  return (
    <div id="pattern-accuracy-container" className="space-y-5">
      {/* Top Banner & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100/80 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              지능형 자동 학습 패턴 정확도 (성공/실패율) 분석
              <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white font-bold rounded-full">
                실시간 연동
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              사용자 지정 규칙 및 자동 학습된 키워드 패턴의 매칭 적합도와 오분류 재작업 비율을 추적합니다.
            </p>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'bar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>비교 차트</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pie')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'pie'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>종합 비율</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>상세 목록</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>종합 매칭 성공률</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {overall.overallSuccessRate}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600">
              {overall.totalSuccess}건 일치
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${overall.overallSuccessRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>재분류/실패율</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600 font-mono">
              {overall.overallFailureRate}%
            </span>
            <span className="text-[10px] font-bold text-rose-600">
              {overall.totalFailure}건 수정됨
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${overall.overallFailureRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>최우수 신뢰 패턴</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-black text-slate-800 truncate mt-1" title={overall.topPerformingPattern || '데이터 없음'}>
            {overall.topPerformingPattern || '평가 전'}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            성공률 높은 상위 패턴
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-3.5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
            <span>주의/개선 필요 패턴</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-amber-700 truncate mt-1" title={overall.needsAttentionPattern || '없음 (양호)'}>
            {overall.needsAttentionPattern || '없음 (정확도 우수)'}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            재분류 빈도가 높은 패턴
          </div>
        </div>
      </div>

      {/* Alert Callout for Low Performance Rules (<= 50% success rate) */}
      {overall.lowPerformanceCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-black text-rose-900">
                  성공률 50% 이하 분류 패턴 {overall.lowPerformanceCount}건 감지
                </h4>
                <span className="text-[10px] px-2 py-0.5 bg-rose-200 text-rose-800 font-bold rounded-full">
                  수정 또는 삭제 권장
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                해당 패턴은 시트에서 다른 카테고리로 재분류된 비율이 높아 오분류를 유발하고 있습니다. 
                키워드를 더 구체화하여 수정하거나, 불필요한 규칙을 삭제해 분류 정확도를 개선하세요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setFilterLowSuccessOnly(!filterLowSuccessOnly);
                if (viewMode !== 'table') setViewMode('table');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterLowSuccessOnly
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/60'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterLowSuccessOnly ? '전체 보기' : '저조 패턴만 목록 필터링'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Chart Section */}
      {displayStats.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
          <Sliders className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {filterLowSuccessOnly 
              ? '성공률 50% 이하인 규칙이 없습니다. 모든 패턴이 정상적으로 작동하고 있습니다.' 
              : '등록된 지능형 자동 학습 규칙이 없습니다.'}
          </p>
          <p className="text-[11px] text-slate-400">
            {filterLowSuccessOnly 
              ? '전체 규칙을 보려면 상단의 저조 규칙 필터를 해제하세요.' 
              : '품목 분류 시 규칙을 등록하거나 자동 학습을 켜 두시면 통계가 실시간 수집됩니다.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
          {/* Subheader & Chart Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800">
                {viewMode === 'bar' ? '패턴별 성공 vs 실패율 비교 차트 (상위 15개)' : viewMode === 'pie' ? '전체 패턴 분류 정확도 구성비' : '전체 학습 패턴 성과 통계표'}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md">
                총 {displayStats.length}개 패턴
              </span>
              {filterLowSuccessOnly && (
                <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-md border border-rose-200">
                  성공률 50% 이하 필터 적용 중
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'bar' && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMetricType('count')}
                    className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      metricType === 'count' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    건수 (건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricType('percentage')}
                    className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      metricType === 'percentage' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    비율 (%)
                  </button>
                </div>
              )}

              {overall.lowPerformanceCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterLowSuccessOnly(!filterLowSuccessOnly)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterLowSuccessOnly
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                  title="성공률 50% 이하 규칙만 필터링"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>저조 패턴 ({overall.lowPerformanceCount}건)</span>
                </button>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2 py-1 outline-none font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="failureRate">실패율 높은 순 (개선 우선)</option>
                  <option value="successRate">성공률 높은 순</option>
                  <option value="evaluations">매칭 평가 많은 순</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterActiveOnly}
                  onChange={(e) => setFilterActiveOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>활성 규칙만</span>
              </label>
            </div>
          </div>

          {/* VIEW: Bar Chart */}
          {viewMode === 'bar' && (
            <div className="w-full h-72 sm:h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    domain={metricType === 'percentage' ? [0, 100] : [0, 'auto']}
                    unit={metricType === 'percentage' ? '%' : ''}
                  />
                  <Tooltip 
                    formatter={customTooltipFormatter}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      padding: '10px 14px'
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `'${item.fullName}' → [${item.category}]` : label;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} 
                  />
                  {metricType === 'count' ? (
                    <>
                      <Bar 
                        dataKey="successCount" 
                        name="성공 (유지/일치)" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={32}
                      />
                      <Bar 
                        dataKey="failureCount" 
                        name="실패 (오분류/재분류)" 
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={32}
                      />
                    </>
                  ) : (
                    <>
                      <Bar 
                        dataKey="successPct" 
                        stackId="a" 
                        name="성공률 (%)" 
                        fill="#10b981" 
                        radius={[0, 0, 0, 0]} 
                        maxBarSize={32}
                      />
                      <Bar 
                        dataKey="failurePct" 
                        stackId="a" 
                        name="실패율 (%)" 
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={32}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* VIEW: Pie Chart */}
          {viewMode === 'pie' && (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
              <div className="w-64 h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any, name: any) => [`${val}건`, name]}
                      contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text in donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800 font-mono">
                    {overall.overallSuccessRate}%
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    전체 정확도
                  </span>
                </div>
              </div>

              {/* Pie Legends & Key Insights */}
              <div className="space-y-3 max-w-sm">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-indigo-600" />
                  지능형 학습 모델 종합 평가
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-bold text-emerald-950">성공 (정상 분류)</span>
                    </div>
                    <span className="font-mono font-black text-emerald-700">
                      {overall.totalSuccess}건 ({overall.overallSuccessRate}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                      <span className="font-bold text-rose-950">실패 (오분류 교정)</span>
                    </div>
                    <span className="font-mono font-black text-rose-700">
                      {overall.totalFailure}건 ({overall.overallFailureRate}%)
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  사용자가 내역서 품목을 검토하면서 수동으로 분류를 변경할 때마다 오분류 패턴이 감지되고 통계에 즉시 반영됩니다.
                </p>
              </div>
            </div>
          )}

          {/* VIEW: Detailed Table & Mismatch Inspector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1 pt-1">
              <span>패턴별 상세 성능 지표 및 불일치 감지</span>
              <span className="text-[10px] text-slate-400 font-normal">
                행을 클릭하면 오분류 품목을 상세 확인할 수 있습니다.
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[42vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">패턴 키워드</th>
                    <th className="py-2.5 px-3">대상 카테고리</th>
                    <th className="py-2.5 px-2 text-center">우선순위</th>
                    <th className="py-2.5 px-3 text-right">성공</th>
                    <th className="py-2.5 px-3 text-right">실패</th>
                    <th className="py-2.5 px-3 text-right">성공률</th>
                    <th className="py-2.5 px-3 text-center">상태</th>
                    <th className="py-2.5 px-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayStats.map(stat => {
                    const isExpanded = expandedRuleId === stat.id;
                    const hasMismatches = stat.mismatchedItems.length > 0 || stat.totalFailure > 0;
                    const isLow = isLowSuccessRule(stat);
                    
                    return (
                      <React.Fragment key={stat.id}>
                        <tr 
                          onClick={() => hasMismatches && setExpandedRuleId(isExpanded ? null : stat.id)}
                          className={`transition-colors ${
                            isLow
                              ? 'bg-rose-50/60 hover:bg-rose-100/70 border-l-4 border-l-rose-500'
                              : isExpanded 
                                ? 'bg-indigo-50/50' 
                                : 'hover:bg-indigo-50/40'
                          } ${hasMismatches ? 'cursor-pointer' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-black text-slate-800 flex items-center gap-1.5">
                            {hasMismatches ? (
                              isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )
                            ) : (
                              <div className="w-3.5 h-3.5" />
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[140px] sm:max-w-[180px]" title={stat.pattern}>
                                '{stat.pattern}'
                              </span>
                              {isLow && (
                                <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-200 text-rose-800 rounded">
                                  저조
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md">
                              {stat.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-500">
                            {stat.priority}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                            {stat.totalSuccess}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                            {stat.totalFailure}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={`h-full rounded-full ${
                                    stat.successRate >= 90 ? 'bg-emerald-500' : stat.successRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${stat.successRate}%` }}
                                />
                              </div>
                              <span className={`font-mono font-black ${
                                stat.successRate >= 90 ? 'text-emerald-700' : stat.successRate >= 70 ? 'text-amber-700' : 'text-rose-700'
                              }`}>
                                {stat.successRate}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isLow ? (
                              <span className="px-2 py-0.5 text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-300 rounded-md inline-flex items-center justify-center gap-1 shadow-2xs">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                                수정/삭제 권장
                              </span>
                            ) : stat.failureRate === 0 ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                                정상
                              </span>
                            ) : stat.failureRate <= 30 ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                                주의
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full">
                                점검권장
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {onSelectRuleForEdit && (
                                <button
                                  type="button"
                                  onClick={() => onSelectRuleForEdit(stat.id)}
                                  className={`p-1 rounded transition-colors ${
                                    isLow 
                                      ? 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 shadow-2xs font-bold text-[11px] px-1.5 flex items-center gap-1' 
                                      : 'text-slate-400 hover:text-indigo-600 hover:bg-white'
                                  }`}
                                  title="규칙 수정 (키워드 구체화)"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  {isLow && <span>수정</span>}
                                </button>
                              )}
                              {onDeleteRule && isLow && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteRule(stat.id)}
                                  className="p-1 px-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors shadow-2xs font-bold text-[11px] flex items-center gap-1"
                                  title="오분류 패턴 삭제 제안"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>삭제</span>
                                </button>
                              )}
                              {onResetRuleStats && stat.totalEvaluations > 0 && !isLow && (
                                <button
                                  type="button"
                                  onClick={() => onResetRuleStats(stat.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                                  title="누적 성과 통계 초기화"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Mismatch Inspector Expandable Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="p-3 border-y border-slate-200">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                    '{stat.pattern}' 패턴에서 감지된 오분류 / 재분류 품목 내역
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    기대 카테고리: <strong className="text-indigo-600">{stat.category}</strong>
                                  </span>
                                </div>

                                {isLow && (
                                  <div className="p-2.5 bg-rose-100/70 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                      <span className="text-rose-900 font-bold">
                                        성공률 {stat.successRate}%로 오분류 위험이 큽니다. 키워드를 더 고유한 명칭으로 구체화하거나 삭제를 권장합니다.
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                      {onSelectRuleForEdit && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectRuleForEdit(stat.id)}
                                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 shadow-2xs text-xs flex items-center gap-1 cursor-pointer"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          키워드 수정 제안
                                        </button>
                                      )}
                                      {onDeleteRule && (
                                        <button
                                          type="button"
                                          onClick={() => onDeleteRule(stat.id)}
                                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-2xs text-xs flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          규칙 삭제 제안
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {stat.mismatchedItems.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic">
                                    현재 로드된 시트에는 오분류 품목이 없으며, 과거 세션에서 {stat.histFailure}건의 수정 내역이 누적되어 있습니다.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    {stat.mismatchedItems.map((m, idx) => (
                                      <div 
                                        key={idx} 
                                        className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-bold text-slate-800 truncate">{m.name}</div>
                                          <div className="text-[10px] text-slate-400 truncate">{m.specification || '규격 없음'}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                          <span className="line-through text-slate-400">{m.expectedCategory}</span>
                                          <span className="text-slate-300">→</span>
                                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold border border-rose-200 rounded">
                                            {m.currentCategory}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
