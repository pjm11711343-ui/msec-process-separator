import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogIn, ShieldCheck, Loader2, UserPlus } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  AppUser, authEnabled, LOCAL_USER, watchAuth, loadProfile, isAdminRegistered, registerFirstAdmin,
  signInWithName, signOutUser, setCurrentAppUser, authErrorMessage,
} from '../lib/auth';

interface AuthCtx {
  user: AppUser;
  signOut: () => void;
}
const Ctx = createContext<AuthCtx>({ user: LOCAL_USER, signOut: () => {} });
export const useAuthUser = () => useContext(Ctx);

const LAST_ID_KEY = 'msec_ps_last_login_id';

function readLastId() {
  try { return localStorage.getItem(LAST_ID_KEY) || ''; } catch { return ''; }
}
function saveLastId(v: string) {
  try { localStorage.setItem(LAST_ID_KEY, v); } catch {}
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'login' | 'ready'>(authEnabled ? 'loading' : 'ready');
  const [user, setUser] = useState<AppUser | null>(authEnabled ? null : LOCAL_USER);
  const [name, setName] = useState(readLastId());
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authEnabled) { setCurrentAppUser(LOCAL_USER); return; }
    let unsubProfile = () => {};
    const unsub = watchAuth(async fbUser => {
      unsubProfile();
      if (!fbUser) {
        setUser(null);
        setCurrentAppUser(null);
        try {
          setPhase((await isAdminRegistered()) ? 'login' : 'setup');
        } catch {
          setPhase('login');
        }
        return;
      }
      try {
        // 최초 관리자 등록 직후에는 계정 정보 저장이 조금 늦게 끝날 수 있어 잠시 기다림
        let profile = await loadProfile(fbUser.uid);
        for (let i = 0; !profile && i < 10; i++) {
          await new Promise(r => setTimeout(r, 400));
          profile = await loadProfile(fbUser.uid).catch(() => null);
        }
        if (!profile || !profile.active) {
          await signOutUser();
          setError(profile ? '사용이 중지된 계정입니다. 관리자에게 문의하세요.' : '등록되지 않은 계정입니다. 관리자에게 문의하세요.');
          return;
        }
        setUser(profile);
        setCurrentAppUser(profile);
        setPhase('ready');
        // 사용 중지·권한 변경을 실시간 반영
        unsubProfile = onSnapshot(doc(db, 'app_users', fbUser.uid), snap => {
          const data = snap.data() as any;
          if (!snap.exists() || !data?.active) {
            signOutUser();
            setError('관리자가 계정 사용을 중지했습니다.');
            return;
          }
          const next = { uid: fbUser.uid, ...data } as AppUser;
          setUser(next);
          setCurrentAppUser(next);
        }, () => {});
      } catch (e) {
        await signOutUser();
        setError(authErrorMessage(e));
      }
    });
    return () => { unsub(); unsubProfile(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (phase === 'setup' && password !== password2) { setError('비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      if (phase === 'setup') await registerFirstAdmin(name, password);
      else await signInWithName(name, password);
      saveLastId(name.trim());
      setPassword('');
      setPassword2('');
    } catch (err: any) {
      setError(err?.code ? authErrorMessage(err) : (err?.message || '처리 중 오류가 발생했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'ready' && user) {
    return (
      <Ctx.Provider value={{ user, signOut: () => { if (authEnabled) signOutUser(); } }}>
        {children}
      </Ctx.Provider>
    );
  }

  const isSetup = phase === 'setup';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1220] px-4" style={{ fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif' }}>
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#e8a33d 1px, transparent 1px), linear-gradient(90deg, #e8a33d 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icons/icon-192.png" alt="" className="w-16 h-16 rounded-2xl shadow-lg mb-3" />
          <h1 className="text-white text-lg font-bold tracking-tight">기계설비 공정분리 자동화 툴</h1>
          <p className="text-white/50 text-xs mt-1">명신기공</p>
        </div>

        {phase === 'loading' ? (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-10">
            <Loader2 size={16} className="animate-spin" /> 확인 중...
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              {isSetup ? <ShieldCheck size={18} className="text-[#b97a14]" /> : <LogIn size={18} className="text-[#0a1220]" />}
              <h2 className="font-bold text-slate-800">{isSetup ? '최초 관리자 등록' : '로그인'}</h2>
            </div>
            {isSetup && (
              <p className="text-[12px] text-slate-500 leading-relaxed bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                처음 한 번만 나오는 화면입니다. 여기서 만든 계정이 <b>관리자</b>가 되며, 이후 직원 계정은 관리자가 [사용자 관리]에서 만듭니다.
              </p>
            )}
            <label className="block">
              <span className="text-[12px] font-bold text-slate-600">이름</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus={!name}
                autoComplete="username"
                placeholder="예: 홍길동"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-bold text-slate-600">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus={!!name}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                placeholder={isSetup ? '6자 이상' : ''}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
              />
            </label>
            {isSetup && (
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">비밀번호 확인</span>
                <input
                  type="password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#e8a33d]"
                />
              </label>
            )}
            {error && <p className="text-[12px] font-bold text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !name.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0a1220] hover:bg-[#13233a] text-white font-bold text-sm disabled:opacity-40 cursor-pointer"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : isSetup ? <UserPlus size={15} /> : <LogIn size={15} />}
              {isSetup ? '관리자 등록하고 시작' : '로그인'}
            </button>
            {!isSetup && (
              <p className="text-[11px] text-slate-400 text-center">계정이 없거나 비밀번호를 잊었으면 관리자에게 문의하세요.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
