/** 현재 로그인한 작업자 (의존성 없는 모듈 — firebase/auth 어디서나 참조 가능) */
export interface CurrentUserInfo { uid: string; name: string; role: 'admin' | 'staff' }
let current: CurrentUserInfo | null = null;
export function setCurrentUserInfo(u: CurrentUserInfo | null) { current = u ? { uid: u.uid, name: u.name, role: u.role } : null; }
export function currentUserName(): string { return current?.name || ''; }
export function isCurrentUserAdmin(): boolean { return current?.role === 'admin'; }
