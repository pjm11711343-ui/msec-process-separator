/**
 * 앱(아이콘) 설치 지원
 * - 서비스워커 등록 (배포 환경에서만)
 * - 설치 안내 이벤트(beforeinstallprompt) 보관 → 화면의 '앱 설치' 버튼에서 사용
 * - 설치된 앱으로 엑셀 파일을 열면(파일 연결) 업로드 칸에 자동으로 넣어줌
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || (navigator as any).standalone === true
      || new URLSearchParams(location.search).get('source') === 'app';
  } catch {
    return false;
  }
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt;
}

export function onInstallStateChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const ev = deferredPrompt;
  deferredPrompt = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  notify();
  return outcome;
}

function feedFileToUploader(file: File, tries = 0) {
  const input = document.querySelector<HTMLInputElement>('input[type=file][accept*="xlsx"]');
  if (!input) {
    if (tries < 40) setTimeout(() => feedFileToUploader(file, tries + 1), 250);
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setupPwa() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[앱] 서비스워커 등록 실패', err));
    });
  }

  // 설치된 앱의 '파일 열기' (엑셀 파일 → 공정분리로 열기)
  const lq = (window as any).launchQueue;
  if (lq && typeof lq.setConsumer === 'function') {
    lq.setConsumer(async (params: any) => {
      const handle = params?.files?.[0];
      if (!handle) return;
      try {
        const file: File = await handle.getFile();
        feedFileToUploader(file);
      } catch (e) {
        console.warn('[앱] 파일 열기 실패', e);
      }
    });
  }
}
