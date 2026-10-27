import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { X, GitCompare, ArrowRight, FileSpreadsheet, Search } from 'lucide-react';
import { SpecItem } from '../types';
import { SnapshotMeta, SNAPSHOT_KIND_LABEL } from '../lib/snapshots';
import { diffSnapshots, DiffKind, DIFF_KIND_LABEL, DiffRow } from '../utils/snapshotDiff';

interface Props {
  base: SnapshotMeta;
  snapshots: SnapshotMeta[];
  currentItems: SpecItem[];
  currentProjectName: string;
  loadItems: (meta: SnapshotMeta) => Promise<SpecItem[]>;
  onClose: () => void;
}

const KIND_ORDER: DiffKind[] = ['category', 'section', 'quantity', 'amount', 'added', 'removed'];
const KIND_CHIP: Record<DiffKind, string> = {
  category: 'bg-[#e8a33d] text-[#0a1220]',
  section: 'bg-sky-600 text-white',
  quantity: 'bg-violet-600 text-white',
  amount: 'bg-slate-600 text-white',
  added: 'bg-emerald-600 text-white',
  removed: 'bg-rose-600 text-white',
};
const MAX_ROWS = 600;

function fmtDate(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const snapLabel = (s: SnapshotMeta) => `${fmtDate(s.createdAt)} ${s.memo || SNAPSHOT_KIND_LABEL[s.kind] || ''}`.trim();
const fmtNum = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/,/g, '')) || 0;
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};
const sectionText = (i?: SpecItem) => (i?.section || '').replace(/\s+/g, ' ').trim();

export default function SnapshotCompare({ base, snapshots, currentItems, currentProjectName, loadItems, onClose }: Props) {
  const [baseItems, setBaseItems] = useState<SpecItem[] | null>(null);
  const [targetId, setTargetId] = useState<string>('current');
  const [targetItems, setTargetItems] = useState<SpecItem[] | null>(currentItems);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<DiffKind | 'all'>('all');
  const [move, setMove] = useState<{ from: string; to: string } | null>(null);
  const [search, setSearch] = useState('');

  const sameSite = snapshots.filter(s => s.projectName === base.projectName && s.id !== base.id);

  useEffect(() => {
    loadItems(base).then(setBaseItems).catch(e => setError(e?.message || '저장본을 불러오지 못했습니다.'));
  }, [base.id]);

  useEffect(() => {
    if (targetId === 'current') { setTargetItems(currentItems); return; }
    const meta = snapshots.find(s => s.id === targetId);
    if (!meta) return;
    setTargetItems(null);
    loadItems(meta).then(setTargetItems).catch(e => setError(e?.message || '비교 저장본을 불러오지 못했습니다.'));
  }, [targetId, currentItems]);

  const result = useMemo(
    () => (baseItems && targetItems ? diffSnapshots(baseItems, targetItems) : null),
    [baseItems, targetItems]
  );

  const visible = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    return result.rows.filter(r => {
      if (filter !== 'all' && !r.kinds.includes(filter)) return false;
      if (move) {
        const from = (r.before?.category || '').trim() || '미분류';
        const to = (r.after?.category || '').trim() || '미분류';
        if (!r.kinds.includes('category') || from !== move.from || to !== move.to) return false;
      }
      if (q) {
        const it = r.after || r.before!;
        const hay = `${it.name} ${it.specification} ${it.section} ${r.before?.category || ''} ${r.after?.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [result, filter, move, search]);

  const targetLabel = targetId === 'current'
    ? `현재 작업${currentProjectName && currentProjectName !== base.projectName ? ` (${currentProjectName})` : ''}`
    : snapLabel(snapshots.find(s => s.id === targetId)!);

  const handleExport = () => {
    if (!result) return;
    const data = visible.map(r => {
      const it = r.after || r.before!;
      return {
        '변경 내용': r.kinds.map(k => DIFF_KIND_LABEL[k]).join(', '),
        '공정(이전)': sectionText(r.before),
        '공정(현재)': sectionText(r.after),
        '품명': it.name,
        '규격': it.specification,
        '단위': it.unit,
        '카테고리(이전)': r.before ? (r.before.category || '미분류') : '',
        '카테고리(현재)': r.after ? (r.after.category || '미분류') : '',
        '수량(이전)': r.before ? r.before.quantity : '',
        '수량(현재)': r.after ? r.after.quantity : '',
        '금액(이전)': r.before ? r.before.amount : '',
        '금액(현재)': r.after ? r.after.amount : '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 34 }, { wch: 30 }, { wch: 24 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '변경내역');
    const summary = [
      { 항목: '기준', 내용: `${base.projectName} ${snapLabel(base)}` },
      { 항목: '비교', 내용: targetLabel },
      ...KIND_ORDER.map(k => ({ 항목: DIFF_KIND_LABEL[k], 내용: `${result.counts[k]}건` })),
      { 항목: '변경 없음', 내용: `${result.unchanged}건` },
      ...result.categoryMoves.map(m => ({ 항목: `${m.from} → ${m.to}`, 내용: `${m.count}건` })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), '요약');
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    XLSX.writeFile(wb, `${base.projectName}_저장본비교_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`);
  };

  const cellChange = (r: DiffRow, field: 'category' | 'quantity' | 'amount', kind: DiffKind) => {
    const b = r.before ? (field === 'category' ? (r.before.category || '미분류') : fmtNum(r.before[field])) : '';
    const a = r.after ? (field === 'category' ? (r.after.category || '미분류') : fmtNum(r.after[field])) : '';
    if (!r.before) return <span className="text-emerald-700">{a}</span>;
    if (!r.after) return <span className="text-rose-600 line-through">{b}</span>;
    if (!r.kinds.includes(kind)) return <span className="text-slate-500">{a}</span>;
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="text-slate-400 line-through">{b}</span>
        <ArrowRight size={11} className="text-slate-400 shrink-0" />
        <span className="font-bold text-[#0a1220] bg-amber-100 px-1 rounded">{a}</span>
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-7xl h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0a1220] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#e8a33d] text-[#0a1220]"><GitCompare size={20} /></div>
            <div className="min-w-0">
              <h3 className="font-bold text-base">저장본 비교 — {base.projectName}</h3>
              <div className="flex items-center gap-2 text-xs text-white/70 mt-0.5 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-white/10">기준: {snapLabel(base)}</span>
                <ArrowRight size={12} />
                <select
                  value={targetId}
                  onChange={e => { setTargetId(e.target.value); setMove(null); }}
                  className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white text-xs cursor-pointer"
                >
                  <option value="current" className="text-slate-800">현재 작업</option>
                  {sameSite.map(s => (
                    <option key={s.id} value={s.id} className="text-slate-800">저장본 {snapLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!result || visible.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer disabled:opacity-40"
              title="보이는 변경 내역을 엑셀로 저장"
            >
              <FileSpreadsheet size={14} /> 비교 결과 엑셀
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="닫기"><X size={18} /></button>
          </div>
        </div>

        {error && <div className="px-6 py-3 bg-rose-50 text-rose-700 text-sm font-bold">{error}</div>}

        {!result ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">비교 중...</div>
        ) : (
          <>
            {/* Summary */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => { setFilter('all'); setMove(null); }}
                  className={`px-2.5 py-1 rounded-full font-bold cursor-pointer ${filter === 'all' && !move ? 'bg-[#0a1220] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                >
                  전체 변경 {result.rows.length.toLocaleString()}
                </button>
                {KIND_ORDER.map(k => (
                  <button
                    key={k}
                    disabled={result.counts[k] === 0}
                    onClick={() => { setFilter(k); setMove(null); }}
                    className={`px-2.5 py-1 rounded-full font-bold cursor-pointer disabled:opacity-35 disabled:cursor-default ${filter === k && !move ? KIND_CHIP[k] : 'bg-white border border-slate-200 text-slate-600'}`}
                  >
                    {DIFF_KIND_LABEL[k]} {result.counts[k].toLocaleString()}
                  </button>
                ))}
                <span className="ml-1 text-slate-400">변경 없음 {result.unchanged.toLocaleString()}</span>
                <div className="ml-auto relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="품명·규격·공정·카테고리 검색"
                    className="pl-7 pr-2 py-1 w-56 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
                  />
                </div>
              </div>
              {result.categoryMoves.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 font-bold mr-1">카테고리 이동</span>
                  {result.categoryMoves.slice(0, 14).map(m => {
                    const on = move && move.from === m.from && move.to === m.to;
                    return (
                      <button
                        key={`${m.from}>${m.to}`}
                        onClick={() => { setMove(on ? null : { from: m.from, to: m.to }); setFilter('all'); }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border cursor-pointer ${on ? 'bg-[#e8a33d] border-[#e8a33d] text-[#0a1220] font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-[#e8a33d]'}`}
                      >
                        {m.from} <ArrowRight size={10} /> {m.to} <b>{m.count}</b>
                      </button>
                    );
                  })}
                  {result.categoryMoves.length > 14 && <span className="text-slate-400">외 {result.categoryMoves.length - 14}종</span>}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {visible.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400">
                  {result.rows.length === 0 ? '두 시점의 내용이 같습니다. 바뀐 품목이 없습니다.' : '조건에 맞는 변경 내역이 없습니다.'}
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e2e8f0] z-10">
                    <tr className="text-[11px] text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold w-[110px]">변경</th>
                      <th className="px-3 py-2 text-left font-semibold">공정</th>
                      <th className="px-3 py-2 text-left font-semibold">품명</th>
                      <th className="px-3 py-2 text-left font-semibold">규격</th>
                      <th className="px-3 py-2 text-left font-semibold">카테고리</th>
                      <th className="px-3 py-2 text-right font-semibold">수량</th>
                      <th className="px-3 py-2 text-right font-semibold">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, MAX_ROWS).map((r, idx) => {
                      const it = r.after || r.before!;
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-amber-50/40 align-top">
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-0.5">
                              {r.kinds.map(k => (
                                <span key={k} className={`px-1.5 py-[1px] rounded text-[10px] font-bold whitespace-nowrap ${KIND_CHIP[k]}`}>{DIFF_KIND_LABEL[k].replace(' 변경', '').replace('된 품목', '').replace(' 품목', '')}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-[12px] text-slate-600 max-w-[280px]">
                            {r.kinds.includes('section') ? (
                              <div>
                                <div className="text-slate-400 line-through">{sectionText(r.before)}</div>
                                <div className="font-bold text-sky-800">{sectionText(r.after)}</div>
                              </div>
                            ) : sectionText(it)}
                          </td>
                          <td className="px-3 py-1.5 font-medium">{it.name}</td>
                          <td className="px-3 py-1.5 text-slate-600">{it.specification}</td>
                          <td className="px-3 py-1.5">{cellChange(r, 'category', 'category')}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{cellChange(r, 'quantity', 'quantity')}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{cellChange(r, 'amount', 'amount')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {visible.length > MAX_ROWS && (
                <div className="py-3 text-center text-xs text-slate-500 bg-slate-50">
                  화면에는 {MAX_ROWS.toLocaleString()}건까지 표시합니다 (전체 {visible.length.toLocaleString()}건은 <b>비교 결과 엑셀</b>로 확인하세요)
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
