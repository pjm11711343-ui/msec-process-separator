import React, { useEffect, useRef, useState } from 'react';
import { UserCircle2, LogOut, KeyRound, Users, X, Loader2, UserPlus } from 'lucide-react';
import { useAuthUser } from './AuthGate';
import {
  AppUser, UserRole, ROLE_LABEL, authEnabled, changeMyPassword, createStaffAccount, setUserActive, setUserRole,
  subscribeUsers, authErrorMessage,
} from '../lib/auth';

interface Props {
  variant?: 'dark' | 'light';
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function fmt(ts?: number) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Modal({ title, icon, onClose, children, wide }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div onMouseDown={e => e.stopPropagation()} className={`w-full ${wide ? 'max-w-3xl' : 'max-w-sm'} max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800`}>
        <div className="px-5 py-3.5 bg-[#0a1220] text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">{icon}{title}</div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose, onNotify }: { onClose: () => void; onNotify?: Props['onNotify'] }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== next2) { setError('새 비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      await changeMyPassword(cur, next);
      onNotify?.('비밀번호를 변경했습니다.', 'success');
      onClose();
    } catch (err: any) {
      setError(err?.code ? authErrorMessage(err) : err?.message);
    } finally {
      setBusy(false);
    }
  };
  const input = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8a33d]';
  return (
    <Modal title="비밀번호 변경" icon={<KeyRound size={16} />} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-3">
        <label className="block"><span className="text-xs font-bold text-slate-600">현재 비밀번호</span>
          <input type="password" autoFocus value={cur} onChange={e => setCur(e.target.value)} className={input} autoComplete="current-password" /></label>
        <label className="block"><span className="text-xs font-bold text-slate-600">새 비밀번호 (6자 이상)</span>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} className={input} autoComplete="new-password" /></label>
        <label className="block"><span className="text-xs font-bold text-slate-600">새 비밀번호 확인</span>
          <input type="password" value={next2} onChange={e => setNext2(e.target.value)} className={input} autoComplete="new-password" /></label>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <button type="submit" disabled={busy || !cur || !next} className="w-full py-2 rounded-lg bg-[#0a1220] text-white font-bold text-sm disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
          {busy && <Loader2 size={14} className="animate-spin" />} 변경
        </button>
      </form>
    </Modal>
  );
}

function UserManagerModal({ me, onClose, onNotify }: { me: AppUser; onClose: () => void; onNotify?: Props['onNotify'] }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeUsers(setUsers), []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await createStaffAccount(name, pw, role, me.name);
      onNotify?.(`'${u.name}' 계정을 만들었습니다. 이름과 초기 비밀번호를 본인에게 알려주세요.`, 'success');
      setName('');
      setPw('');
      setRole('staff');
    } catch (err: any) {
      setError(err?.code ? authErrorMessage(err) : err?.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: AppUser) => {
    if (u.uid === me.uid) return;
    if (u.active && !window.confirm(`'${u.name}' 계정 사용을 중지할까요?\n중지하면 바로 로그아웃되고 다시 로그인할 수 없습니다.`)) return;
    try { await setUserActive(u.uid, !u.active); } catch (err) { onNotify?.(authErrorMessage(err), 'error'); }
  };

  const changeRole = async (u: AppUser, r: UserRole) => {
    if (u.uid === me.uid) return;
    try { await setUserRole(u.uid, r); } catch (err) { onNotify?.(authErrorMessage(err), 'error'); }
  };

  const input = 'px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8a33d]';
  return (
    <Modal title="사용자 관리" icon={<Users size={16} />} onClose={onClose} wide>
      <form onSubmit={add} className="px-5 py-4 bg-slate-50 border-b border-slate-100 space-y-2">
        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><UserPlus size={14} /> 직원 계정 만들기</div>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="이름 (로그인 아이디)" className={`${input} w-40`} />
          <input value={pw} onChange={e => setPw(e.target.value)} placeholder="초기 비밀번호 (6자 이상)" className={`${input} w-48`} autoComplete="off" />
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={`${input} cursor-pointer`}>
            <option value="staff">직원</option>
            <option value="admin">관리자</option>
          </select>
          <button type="submit" disabled={busy || !name.trim() || pw.length < 6} className="px-4 py-2 rounded-lg bg-[#e8a33d] hover:bg-[#f0b456] text-[#0a1220] font-bold text-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
            {busy && <Loader2 size={14} className="animate-spin" />} 만들기
          </button>
        </div>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <p className="text-[11px] text-slate-500">
          직원은 로그인 후 [내 비밀번호 변경]으로 비밀번호를 바꿀 수 있습니다. 비밀번호를 잊은 직원은 기존 계정을 <b>사용 중지</b>하고 새 이름(예: 홍길동2)으로 다시 만들어 주세요.
        </p>
      </form>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-slate-500 border-b border-slate-200">
            <th className="px-5 py-2 text-left font-semibold">이름</th>
            <th className="px-3 py-2 text-left font-semibold">권한</th>
            <th className="px-3 py-2 text-left font-semibold">마지막 로그인</th>
            <th className="px-3 py-2 text-left font-semibold">만든 사람</th>
            <th className="px-5 py-2 text-right font-semibold">상태</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.uid} className={`border-b border-slate-100 ${u.active ? '' : 'opacity-50'}`}>
              <td className="px-5 py-2 font-bold">{u.name}{u.uid === me.uid && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(나)</span>}</td>
              <td className="px-3 py-2">
                <select value={u.role} disabled={u.uid === me.uid} onChange={e => changeRole(u, e.target.value as UserRole)} className="px-2 py-1 rounded border border-slate-200 text-xs cursor-pointer disabled:cursor-default">
                  <option value="staff">직원</option>
                  <option value="admin">관리자</option>
                </select>
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-500">{fmt(u.lastLoginAt)}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{u.createdBy || '-'}</td>
              <td className="px-5 py-2 text-right">
                <button
                  onClick={() => toggleActive(u)}
                  disabled={u.uid === me.uid}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer disabled:cursor-default disabled:opacity-60 ${u.active ? 'bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                  title={u.uid === me.uid ? '본인 계정은 중지할 수 없습니다' : u.active ? '누르면 사용 중지' : '누르면 다시 사용'}
                >
                  {u.active ? '사용 중' : '중지됨'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export default function UserMenu({ variant = 'dark', onNotify }: Props) {
  const { user, signOut } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<'password' | 'users' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (!authEnabled) return null;

  const btn = variant === 'dark'
    ? 'px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold rounded border border-white/20 text-white'
    : 'px-3 py-2 bg-white hover:bg-slate-50 text-sm font-bold rounded-xl border border-slate-200 text-slate-700 shadow-sm';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className={`${btn} flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0`} title="내 계정">
        <UserCircle2 size={variant === 'dark' ? 13 : 16} />
        {user.name}
        {user.role === 'admin' && <span className="px-1 rounded bg-[#e8a33d] text-[#0a1220] text-[9px] font-black">관리자</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 z-[160] rounded-xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden text-sm">
          <div className="px-3.5 py-2.5 border-b border-slate-100">
            <div className="font-bold">{user.name}</div>
            <div className="text-[11px] text-slate-500">{ROLE_LABEL[user.role]} 계정</div>
          </div>
          {user.role === 'admin' && (
            <button onClick={() => { setModal('users'); setOpen(false); }} className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-slate-50 cursor-pointer text-left">
              <Users size={14} className="text-slate-500" /> 사용자 관리
            </button>
          )}
          <button onClick={() => { setModal('password'); setOpen(false); }} className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-slate-50 cursor-pointer text-left">
            <KeyRound size={14} className="text-slate-500" /> 내 비밀번호 변경
          </button>
          <button onClick={() => { setOpen(false); signOut(); }} className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-rose-50 text-rose-600 cursor-pointer text-left border-t border-slate-100">
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      )}
      {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)} onNotify={onNotify} />}
      {modal === 'users' && <UserManagerModal me={user} onClose={() => setModal(null)} onNotify={onNotify} />}
    </div>
  );
}

