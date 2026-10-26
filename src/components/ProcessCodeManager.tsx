import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { X, ListTree, FileSpreadsheet, ClipboardPaste, Trash2, Save, Wand2, Plus } from 'lucide-react';
import { ProcessCodeEntry } from '../types';
import {
  PROCESS_LEVELS,
  levelLabel,
  parseProcessCodeText,
  extractProcessCodesFromWorkbook,
  formatProcessCodeText
} from '../utils/processCodeTable';

interface Props {
  projectName: string;
  initialCodes: ProcessCodeEntry[];
  hasItems: boolean;
  onClose: () => void;
  /** apply=true 이면 저장 후 현재 내역에도 바로 적용 */
  onSave: (codes: ProcessCodeEntry[], apply: boolean) => void;
}

const LEVEL_STYLE: Record<number, string> = {
  2: 'bg-slate-800 text-white',
  4: 'bg-indigo-600 text-white',
  6: 'bg-indigo-100 text-indigo-800',
  8: 'bg-sky-100 text-sky-800',
  10: 'bg-slate-100 text-slate-600',
};

const INDENT: Record<number, string> = { 2: 'pl-0', 4: 'pl-0', 6: 'pl-3', 8: 'pl-7', 10: 'pl-11' };

export default function ProcessCodeManager({ projectName, initialCodes, hasItems, onClose, onSave }: Props) {
  const [codes, setCodes] = useState<ProcessCodeEntry[]>(initialCodes || []);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<number, number> = {};
    codes.forEach(e => { c[e.code.length] = (c[e.code.length] || 0) + 1; });
    return c;
  }, [codes]);

  const sortByCode = (list: ProcessCodeEntry[]) => [...list].sort((a, b) => (a.code && b.code ? a.code.localeCompare(b.code) : 0));

  const flash = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const mergeIn = (incoming: ProcessCodeEntry[], replace: boolean) => {
    if (incoming.length === 0) {
      flash('인식된 공종이 없습니다. "코드  공종명" 형식인지 확인해 주세요.', 'err');
      return;
    }
    setCodes(prev => {
      if (replace) return sortByCode(incoming);
      const map = new Map(prev.map(e => [e.code, e]));
      incoming.forEach(e => map.set(e.code, e));
      return sortByCode(Array.from(map.values()));
    });
    flash(`${incoming.length}개 공종을 ${replace ? '등록' : '추가/갱신'}했습니다.`);
  };

  const handlePaste = () => {
    mergeIn(parseProcessCodeText(pasteText), codes.length === 0);
    setPasteText('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' });
        const found = extractProcessCodesFromWorkbook(wb);
        if (found.length === 0) {
          flash('파일에서 공종표(집계표)를 찾지 못했습니다. 목록을 복사해 붙여넣어 주세요.', 'err');
          return;
        }
        mergeIn(found, true);
      } catch (err) {
        flash('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'err');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateEntry = (idx: number, field: 'code' | 'name', value: string) => {
    setCodes(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: field === 'code' ? value.replace(/\D/g, '') : value } : e)));
  };

  const removeEntry = (idx: number) => setCodes(prev => prev.filter((_, i) => i !== idx));

  const addEntry = () => {
    const parsed = parseProcessCodeText(pasteText);
    if (parsed.length > 0) return handlePaste();
    setCodes(prev => [...prev, { code: '', name: '' }]);
  };

  const validCodes = () => {
    const cleaned = codes
      .map(e => ({ code: e.code.trim(), name: e.name.trim() }))
      .filter(e => PROCESS_LEVELS[e.code.length] && e.name);
    const seen = new Set<string>();
    return cleaned.filter(e => (seen.has(e.code) ? false : (seen.add(e.code), true)));
  };

  const save = (apply: boolean) => {
    const v = validCodes();
    onSave(sortByCode(v), apply);
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
        className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white"><ListTree size={20} /></div>
            <div>
              <h3 className="font-bold text-base">현장 공종표</h3>
              <p className="text-xs text-slate-500">
                {projectName ? `'${projectName}'` : '현재 작업'} — 공정분리 전에 등록하면 내역서 업로드 시 이 표의 코드·공종명으로 공정이 정리됩니다
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          {/* Left: input */}
          <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col gap-3 overflow-y-auto">
            <div className="text-xs font-bold text-slate-600">1. 엑셀에서 가져오기</div>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold"
            >
              <FileSpreadsheet size={16} /> 내역서/공종표 엑셀 선택 (집계표 자동 인식)
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

            <div className="text-xs font-bold text-slate-600 mt-2">2. 목록 붙여넣기</div>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'한 줄에 하나씩 "코드  공종명"\n\n01  금정역푸르지오그랑블\n0101  기계설비공사\n010104  세대내배관공사\n01010401  난방배관공사\n0101040101  59㎡ 단위세대'}
              className="w-full h-56 p-3 text-xs font-mono border border-slate-200 rounded-xl focus:border-indigo-500 outline-none resize-none"
            />
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold"
            >
              <ClipboardPaste size={16} /> {codes.length === 0 ? '붙여넣은 목록 등록' : '붙여넣은 목록 추가/갱신'}
            </button>

            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] leading-relaxed text-slate-500">
              <div className="font-bold text-slate-600 mb-1">코드 자릿수 = 단계</div>
              {Object.entries(PROCESS_LEVELS).map(([len, label]) => (
                <div key={len} className="flex justify-between">
                  <span>{len}자리</span><span className="font-medium text-slate-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: table */}
          <div className="flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-slate-700 mr-1">등록 {codes.length}개</span>
              {Object.entries(PROCESS_LEVELS).map(([len, label]) => (
                <span key={len} className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${LEVEL_STYLE[Number(len)]}`}>
                  {label} {counts[Number(len)] || 0}
                </span>
              ))}
              <div className="ml-auto flex gap-1.5">
                <button onClick={() => navigator.clipboard?.writeText(formatProcessCodeText(sortByCode(codes)))} className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">목록 복사</button>
                <button onClick={addEntry} className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"><Plus size={12} />행 추가</button>
                <button onClick={() => setCodes([])} disabled={codes.length === 0} className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40">전체 비우기</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {codes.length === 0 ? (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-slate-400 text-sm gap-2 p-6 text-center">
                  <ListTree size={36} className="opacity-30" />
                  <p>아직 등록된 공종이 없습니다.</p>
                  <p className="text-xs">왼쪽에서 엑셀(집계표)을 선택하거나 목록을 붙여넣어 주세요.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white shadow-[0_1px_0_#e2e8f0]">
                    <tr className="text-slate-500">
                      <th className="text-left font-bold px-4 py-2 w-28">구분</th>
                      <th className="text-left font-bold px-2 py-2 w-36">코드</th>
                      <th className="text-left font-bold px-2 py-2">공종명</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((e, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/70">
                        <td className="px-4 py-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${LEVEL_STYLE[e.code.length] || 'bg-rose-100 text-rose-700'}`}>
                            {PROCESS_LEVELS[e.code.length] ? levelLabel(e.code) : '자릿수 확인'}
                          </span>
                        </td>
                        <td className={`px-2 py-1 ${INDENT[e.code.length] || ''}`}>
                          <input
                            value={e.code}
                            onChange={ev => updateEntry(idx, 'code', ev.target.value)}
                            className="w-full font-mono bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={e.name}
                            onChange={ev => updateEntry(idx, 'name', ev.target.value)}
                            className={`w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded px-1 py-0.5 outline-none ${e.code.length <= 6 ? 'font-bold' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => removeEntry(idx)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
          {message && (
            <span className={`text-xs font-bold ${message.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{message.text}</span>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">닫기</button>
            <button onClick={() => save(false)} className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-1.5">
              <Save size={15} /> 저장
            </button>
            {hasItems && (
              <button onClick={() => save(true)} className="px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5" title="다시 업로드하지 않고 현재 내역의 공정명·상위 공정을 공종표대로 정리합니다">
                <Wand2 size={15} /> 저장 후 현재 내역에 적용
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
