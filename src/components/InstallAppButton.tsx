import React, { useEffect, useRef, useState } from 'react';
import { MonitorDown, Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { canPromptInstall, isStandalone, onInstallStateChange, promptInstall } from '../lib/pwa';

interface Props {
  variant?: 'dark' | 'light';
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ZIP_URL = '/download/msec-process-separator-icon.zip';

export default function InstallAppButton({ variant = 'dark', onNotify }: Props) {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => onInstallStateChange(() => force(n => n + 1)), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (isStandalone()) return null; // 이미 아이콘(앱)으로 실행 중

  const handleInstall = async () => {
    const r = await promptInstall();
    if (r === 'accepted') {
      onNotify?.('설치되었습니다. 바탕화면·시작 메뉴의 [공정분리] 아이콘으로 실행하세요.', 'success');
      setOpen(false);
    } else if (r === 'unavailable') {
      onNotify?.('이 브라우저에서는 바로 설치가 안 됩니다. 아래 [바탕화면 아이콘 받기]를 이용하세요.', 'info');
    }
  };

  const btnClass = variant === 'dark'
    ? 'px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold rounded border border-white/20 text-white'
    : 'px-3 py-2 bg-white hover:bg-slate-50 text-sm font-bold rounded-xl border border-slate-200 text-slate-700 shadow-sm';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`${btnClass} transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0`}
        title="바탕화면 아이콘으로 설치 / 아이콘 배포 파일 받기"
      >
        <MonitorDown size={variant === 'dark' ? 12 : 16} />
        앱 설치
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] z-[160] rounded-xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden text-left">
          <div className="px-4 py-3 bg-[#0a1220] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icons/icon-192.png" alt="" className="w-7 h-7 rounded-md" />
              <div>
                <div className="text-sm font-bold">공정분리 아이콘 설치</div>
                <div className="text-[10px] text-white/60">주소 대신 아이콘으로 실행 · 항상 최신 버전</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 cursor-pointer"><X size={14} /></button>
          </div>
          <div className="p-3 space-y-2">
            <button
              onClick={handleInstall}
              disabled={!canPromptInstall()}
              className="w-full flex items-start gap-2.5 p-2.5 rounded-lg border border-[#e8a33d] bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-left"
            >
              <CheckCircle2 size={18} className="text-[#b97a14] mt-0.5 shrink-0" />
              <div>
                <div className="text-[13px] font-bold">이 PC에 바로 설치 (추천)</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {canPromptInstall()
                    ? '크롬·엣지 앱으로 설치되어 바탕화면/시작 메뉴/작업표시줄에서 실행됩니다. 엑셀 파일 우클릭 → 연결 프로그램으로도 열 수 있습니다.'
                    : '이미 설치되었거나 이 브라우저에서는 지원되지 않습니다. 크롬·엣지 주소창 오른쪽의 설치 아이콘(⊕)을 눌러도 됩니다.'}
                </div>
              </div>
            </button>
            <a
              href={ZIP_URL}
              download
              className="w-full flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Download size={18} className="text-slate-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-[13px] font-bold">바탕화면 아이콘 받기 (배포용 zip)</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  다른 직원에게 메신저·메일로 전달하는 파일입니다. 압축을 풀고 install_icon.bat 실행 → 바탕화면에 아이콘 생성.
                </div>
              </div>
            </a>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50">
              <Smartphone size={18} className="text-slate-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-slate-600 leading-snug">
                <b>휴대폰</b> · 안드로이드 크롬: 메뉴(⋮) → 홈 화면에 추가<br />
                아이폰 사파리: 공유 버튼 → 홈 화면에 추가
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
