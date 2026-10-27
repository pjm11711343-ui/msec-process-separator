import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, History, Lock, RotateCcw, Trash2, FileSpreadsheet, Cloud, HardDrive, ShieldCheck } from 'lucide-react';
import { SnapshotMeta, SNAPSHOT_KIND_LABEL } from '../lib/snapshots';

interface Props {
  currentProjectName: string;
  snapshots: SnapshotMeta[];
  hasItems: boolean;
  busy: boolean;
  onClose: () => void;
  /** name: 현장명이 없을 때 입력받은 이름 */
  onSave: (memo: string, name?: string) => Promise<boolean>;
  onRestore: (meta: SnapshotMeta) => void;
  onExport: (meta: SnapshotMeta) => void;
  onDelete: (meta: SnapshotMeta, password: string) => Promise<boolean>;
}

const KIND_STYLE: Record<string, string> = {
  manual: 'bg-[#e8a33d] text-[#0a1220]',
  complete: 'bg-emerald-600 text-white',
  'before-restore': 'bg-slate-200 text-slate-700',
  'before-upload': 'bg-slate-200 text-slate-700',
};

function fmtDate(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SnapshotManager({
  currentProjectName, snapshots, hasItems, busy, onClose, onSave, onRestore, onExport, onDelete
}: Props) {
  const [memo, setMemo] = useState('');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'current' | 'all'>(currentProjectName ? 'current' : 'all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const memoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => memoRef.current?.focus(), 50);
  }, []);

  const list = useMemo(
    () => (scope === 'current' && currentProjectName ? snapshots.filter(s => s.projectName === currentProjectName) : snapshots),
    [snapshots, scope, currentProjectName]
  );

  const needName = !currentProjectName;

  const handleSave = async () => {
    if (!hasItems || busy) return;
    if (needName && !name.trim()) return;
    const ok = await onSave(memo, needName ? name.trim() : undefined);
    if (ok) setMemo('');
  };

  const handleDelete = async (meta: SnapshotMeta) => {
    const ok = await onDelete(meta, password);
    if (ok) {
      setDeleting(null);
      setPassword('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0a1220] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#e8a33d] text-[#0a1220]"><History size={20} /></div>
            <div>
              <h3 className="font-bold text-base">저장본 관리</h3>
              <p className="text-xs text-white/60">
                저장한 시점의 공정분리 내용이 그대로 고정 보관됩니다 · 저장본은 수정되지 않고, 불러와서 이어서 작업합니다
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="닫기"><X size={18} /></button>
        </div>

        {/* Save form */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {needName ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="현장명 (필수)"
                className="w-48 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
              />
            ) : (
              <span className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold">{currentProjectName}</span>
            )}
            <input
              ref={memoRef}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="메모 (예: 위생공종 분류 완료, 덕트 검토 전)"
              className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
            />
            <button
              onClick={handleSave}
              disabled={!hasItems || busy || (needName && !name.trim())}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e8a33d] hover:bg-[#f0b456] text-[#0a1220] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save size={15} />
              {busy ? '저장 중...' : '현재 상태 저장'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Enter 로 바로 저장 · 단축키 <b>Ctrl+S</b> 는 메모 없이 즉시 저장 · 저장본 삭제는 관리자 비밀번호가 필요합니다
            {!hasItems && <span className="text-rose-600 font-bold"> · 저장할 내역이 없습니다</span>}
          </p>
        </div>

        {/* Scope */}
        <div className="px-6 pt-3 flex items-center gap-2 text-xs">
          <button
            onClick={() => setScope('current')}
            disabled={!currentProjectName}
            className={`px-3 py-1 rounded-full font-bold cursor-pointer disabled:opacity-40 ${scope === 'current' ? 'bg-[#0a1220] text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            현재 현장
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-3 py-1 rounded-full font-bold cursor-pointer ${scope === 'all' ? 'bg-[#0a1220] text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            전체 현장
          </button>
          <span className="ml-auto text-slate-400">{list.length}개 저장본</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {list.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              아직 저장본이 없습니다. 위에서 메모를 적고 <b>현재 상태 저장</b>을 누르세요.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-500 border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">저장 시각</th>
                  {scope === 'all' && <th className="py-2 text-left font-semibold">현장</th>}
                  <th className="py-2 text-left font-semibold">메모</th>
                  <th className="py-2 text-right font-semibold">품목</th>
                  <th className="py-2 text-right font-semibold">미분류</th>
                  <th className="py-2 text-center font-semibold">보관</th>
                  <th className="py-2 text-right font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {list.map(s => (
                  <React.Fragment key={s.id}>
                    <tr className="border-b border-slate-100 hover:bg-amber-50/40">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Lock size={12} className="text-slate-400 shrink-0" />
                          <span className="font-mono text-[13px]">{fmtDate(s.createdAt)}</span>
                        </div>
                        <span className={`inline-block mt-0.5 px-1.5 py-[1px] rounded text-[10px] font-bold ${KIND_STYLE[s.kind] || KIND_STYLE.manual}`}>
                          {SNAPSHOT_KIND_LABEL[s.kind] || s.kind}
                        </span>
                      </td>
                      {scope === 'all' && <td className="py-2 pr-2 font-bold whitespace-nowrap">{s.projectName}</td>}
                      <td className="py-2 pr-2 text-slate-700 break-all">{s.memo || <span className="text-slate-300">-</span>}</td>
                      <td className="py-2 pr-2 text-right font-mono">{s.itemCount.toLocaleString()}</td>
                      <td className={`py-2 pr-2 text-right font-mono ${s.unclassifiedCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}`}>
                        {s.unclassifiedCount.toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center justify-center gap-1 text-slate-400">
                          <span title={s.where?.cloud ? '클라우드 보관' : '클라우드 미보관'}><Cloud size={13} className={s.where?.cloud ? 'text-sky-500' : 'opacity-30'} /></span>
                          <span title={s.where?.local ? '이 PC 보관' : '이 PC 미보관'}><HardDrive size={13} className={s.where?.local ? 'text-slate-600' : 'opacity-30'} /></span>
                        </div>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => onRestore(s)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0a1220] hover:bg-[#13233a] text-white text-xs font-bold mr-1 cursor-pointer disabled:opacity-40"
                          title="이 저장본을 작업 화면으로 불러옵니다 (저장본 자체는 바뀌지 않음)"
                        >
                          <RotateCcw size={12} /> 불러오기
                        </button>
                        <button
                          onClick={() => onExport(s)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold mr-1 cursor-pointer disabled:opacity-40"
                          title="이 저장본을 엑셀로 다운로드"
                        >
                          <FileSpreadsheet size={12} /> 엑셀
                        </button>
                        <button
                          onClick={() => { setDeleting(deleting === s.id ? null : s.id); setPassword(''); }}
                          className="inline-flex items-center p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="삭제 (비밀번호 필요)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                    {deleting === s.id && (
                      <tr className="bg-rose-50/60">
                        <td colSpan={scope === 'all' ? 7 : 6} className="py-2 px-2">
                          <div className="flex items-center gap-2 text-xs">
                            <ShieldCheck size={14} className="text-rose-600" />
                            <span className="text-rose-700 font-bold">이 저장본을 삭제하려면 관리자 비밀번호를 입력하세요</span>
                            <input
                              type="password"
                              autoFocus
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleDelete(s); }}
                              className="w-28 px-2 py-1 rounded border border-rose-300 text-xs"
                            />
                            <button onClick={() => handleDelete(s)} className="px-2 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer">삭제</button>
                            <button onClick={() => setDeleting(null)} className="px-2 py-1 rounded bg-white border border-slate-200 cursor-pointer">취소</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
