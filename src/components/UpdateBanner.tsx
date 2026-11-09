import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * 새 버전 알림: 배포된 /version.json 의 빌드 번호가 지금 화면과 다르면 알림 표시
 * (5분마다 + 창으로 돌아올 때 확인). 작업 중 화면이 저절로 바뀌지 않도록 새로고침은 직접 누를 때만.
 */
const CHECK_MS = 5 * 60 * 1000;

export default function UpdateBanner({ beforeReload }: { beforeReload?: () => void }) {
  const [latest, setLatest] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = await res.json();
        if (!stopped && build && build !== __APP_BUILD__) setLatest(build);
      } catch {}
    };
    const t0 = setTimeout(check, 20000);
    const iv = setInterval(check, CHECK_MS);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearTimeout(t0); clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  if (!latest || hidden) return null;

  const reload = async () => {
    try { beforeReload?.(); } catch {}
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {}
    setTimeout(() => location.reload(), 300);
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[180] flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl bg-[#0a1220] text-white shadow-2xl border border-[#e8a33d]/50 text-sm">
      <span className="w-2 h-2 rounded-full bg-[#e8a33d] animate-pulse" />
      <span>새 버전이 배포되었습니다. 작업 내용은 저장된 상태로 새로고침됩니다.</span>
      <button onClick={reload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8a33d] hover:bg-[#f0b456] text-[#0a1220] font-bold text-xs cursor-pointer">
        <RefreshCw size={13} /> 새로고침
      </button>
      <button onClick={() => setHidden(true)} className="p-1.5 rounded hover:bg-white/10 cursor-pointer" title="나중에"><X size={14} /></button>
    </div>
  );
}
