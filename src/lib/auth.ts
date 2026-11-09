/**
 * 접속 보호 (직원 계정)
 * - Firebase 인증(이메일/비밀번호)을 사용하되, 직원은 "이름 + 비밀번호"로 로그인
 *   (이름 → 내부용 이메일 주소로 변환, 메일은 발송되지 않음)
 * - 직원 정보: app_users/{uid}  { name, role: 'admin' | 'staff', active, ... }
 * - 최초 관리자 등록 여부: app_meta/auth  { adminUid, createdAt }
 */
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, onSnapshot } from 'firebase/firestore';
import { db, firebaseApp, firebaseAppOptions, isCloudConfigured } from './firebase';
import { setCurrentUserInfo, currentUserName } from './currentUser';

export type UserRole = 'admin' | 'staff';

export interface AppUser {
  uid: string;
  name: string;
  loginId: string;
  role: UserRole;
  active: boolean;
  createdAt: number;
  createdBy?: string;
  lastLoginAt?: number;
}

export const ROLE_LABEL: Record<UserRole, string> = { admin: '관리자', staff: '직원' };

export const auth = getAuth(firebaseApp);

const EMAIL_DOMAIN = 'users.msec-ps.app';

/** 로그인 이름 정리: 앞뒤 공백 제거, 연속 공백 1칸 */
export function normalizeLoginId(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ');
}

/** 이름(한글 가능) → 내부용 이메일 (UTF-8 바이트를 16진수로) */
export function loginIdToEmail(name: string): string {
  const bytes = new TextEncoder().encode(normalizeLoginId(name).toLowerCase());
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `u${hex}@${EMAIL_DOMAIN}`;
}

export function validateNewCredentials(name: string, password: string): string | null {
  const n = normalizeLoginId(name);
  if (!n) return '이름을 입력하세요.';
  if (n.length > 20) return '이름은 20자 이내로 입력하세요.';
  if (password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  return null;
}

export function authErrorMessage(e: any): string {
  const code: string = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email'))
    return '이름 또는 비밀번호가 맞지 않습니다.';
  if (code.includes('too-many-requests')) return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
  if (code.includes('email-already-in-use')) return '이미 등록된 이름입니다. 다른 이름(예: 홍길동2)을 사용하세요.';
  if (code.includes('weak-password')) return '비밀번호는 6자 이상이어야 합니다.';
  if (code.includes('network-request-failed')) return '인터넷 연결을 확인하세요.';
  if (code.includes('requires-recent-login')) return '보안을 위해 다시 로그인한 뒤 시도하세요.';
  if (code.includes('permission-denied')) return '권한이 없습니다. 관리자에게 문의하세요.';
  return e?.message || '처리 중 오류가 발생했습니다.';
}

/* ---------------- 상태 ---------------- */

export async function isAdminRegistered(): Promise<boolean> {
  const snap = await getDoc(doc(db, 'app_meta', 'auth'));
  return snap.exists();
}

export async function loadProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'app_users', uid));
  return snap.exists() ? ({ uid, ...(snap.data() as any) } as AppUser) : null;
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/* ---------------- 로그인 / 등록 ---------------- */

/** 최초 관리자 등록 (관리자가 한 명도 없을 때만) */
export async function registerFirstAdmin(name: string, password: string): Promise<AppUser> {
  const err = validateNewCredentials(name, password);
  if (err) throw new Error(err);
  if (await isAdminRegistered()) throw new Error('이미 관리자가 등록되어 있습니다. 로그인하세요.');
  const loginId = normalizeLoginId(name);
  const cred = await createUserWithEmailAndPassword(auth, loginIdToEmail(loginId), password);
  const uid = cred.user.uid;
  const now = Date.now();
  const profile: Omit<AppUser, 'uid'> = { name: loginId, loginId, role: 'admin', active: true, createdAt: now, createdBy: loginId, lastLoginAt: now };
  const batch = writeBatch(db);
  batch.set(doc(db, 'app_meta', 'auth'), { adminUid: uid, createdAt: now });
  batch.set(doc(db, 'app_users', uid), profile);
  await batch.commit();
  return { uid, ...profile };
}

export async function signInWithName(name: string, password: string): Promise<AppUser> {
  const cred = await signInWithEmailAndPassword(auth, loginIdToEmail(name), password);
  const profile = await loadProfile(cred.user.uid);
  if (!profile || !profile.active) {
    await signOut(auth);
    throw new Error(profile ? '사용이 중지된 계정입니다. 관리자에게 문의하세요.' : '등록되지 않은 계정입니다. 관리자에게 문의하세요.');
  }
  updateDoc(doc(db, 'app_users', cred.user.uid), { lastLoginAt: Date.now() }).catch(() => {});
  return profile;
}

export function signOutUser() {
  return signOut(auth);
}

export async function changeMyPassword(currentPassword: string, nextPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('로그인 상태가 아닙니다.');
  if (nextPassword.length < 6) throw new Error('새 비밀번호는 6자 이상이어야 합니다.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, nextPassword);
}

/* ---------------- 관리자: 직원 관리 ---------------- */

/** 직원 계정 만들기 — 관리자 로그인 상태를 유지하기 위해 보조 인스턴스로 생성 */
export async function createStaffAccount(name: string, password: string, role: UserRole, createdBy: string): Promise<AppUser> {
  const err = validateNewCredentials(name, password);
  if (err) throw new Error(err);
  const loginId = normalizeLoginId(name);
  const secName = `staff-creator-${Date.now()}`;
  const secApp = initializeApp(firebaseAppOptions, secName);
  try {
    const secAuth = getAuth(secApp);
    const cred = await createUserWithEmailAndPassword(secAuth, loginIdToEmail(loginId), password);
    const uid = cred.user.uid;
    await signOut(secAuth);
    const profile: Omit<AppUser, 'uid'> = { name: loginId, loginId, role, active: true, createdAt: Date.now(), createdBy };
    await setDoc(doc(db, 'app_users', uid), profile);
    return { uid, ...profile };
  } finally {
    const a = getApps().find(x => x.name === secName);
    if (a) deleteApp(a).catch(() => {});
  }
}

export async function setUserActive(uid: string, active: boolean) {
  await updateDoc(doc(db, 'app_users', uid), { active });
}

export async function setUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(db, 'app_users', uid), { role });
}

export function subscribeUsers(cb: (users: AppUser[]) => void): () => void {
  return onSnapshot(
    collection(db, 'app_users'),
    snap => cb(snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as AppUser)).sort((a, b) => a.createdAt - b.createdAt)),
    err => console.warn('[사용자] 목록 구독 오류', err)
  );
}

/* ---------------- 현재 사용자 (앱 전체에서 사용) ---------------- */

let current: AppUser | null = null;
export function setCurrentAppUser(u: AppUser | null) { current = u; setCurrentUserInfo(u); }
export function getCurrentAppUser(): AppUser | null { return current; }
export function isAdmin(): boolean { return current?.role === 'admin'; }
export { currentUserName };

/** 클라우드를 쓰지 않는 로컬 모드에서는 로그인 없이 관리자로 동작 */
export const LOCAL_USER: AppUser = { uid: 'local', name: '로컬 사용자', loginId: 'local', role: 'admin', active: true, createdAt: 0 };
export const authEnabled = isCloudConfigured;
