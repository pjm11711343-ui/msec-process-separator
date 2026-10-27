/**
 * 공정분리 저장본 (작업 시점별 고정 저장)
 * - 저장한 시점의 내역·분류·공종표·현장정보를 그대로 고정 보관 (수정 기능 없음, 새로 저장만 가능)
 * - 클라우드(Firestore) + 이 PC(IndexedDB) 두 곳에 저장
 * - 저장 시 지문(해시)을 함께 저장해 불러올 때 원본 그대로인지 확인
 */
import { doc, setDoc, getDoc, deleteDoc, collection, onSnapshot, query } from 'firebase/firestore';
import LZString from 'lz-string';
import { db, isCloudConfigured, isCloudQuotaExceeded } from './firebase';
import { SpecItem, ThemeType, SeparationMethod, ProcessCodeEntry } from '../types';

export type SnapshotKind = 'manual' | 'complete' | 'before-restore' | 'before-upload';

export const SNAPSHOT_KIND_LABEL: Record<SnapshotKind, string> = {
  manual: '수동 저장',
  complete: '완료처리 자동',
  'before-restore': '불러오기 전 자동',
  'before-upload': '재업로드 전 자동',
};

export interface SnapshotMeta {
  id: string;
  projectId: string;
  projectName: string;
  memo: string;
  kind: SnapshotKind;
  createdAt: number;
  itemCount: number;
  unclassifiedCount: number;
  categoryCount: number;
  totalAmount: number;
  hash: string;
  chunks: number;
  where?: { cloud: boolean; local: boolean };
}

export interface SnapshotData {
  items: SpecItem[];
  categories: string[];
  categoryEstimates: Record<string, number>;
  projectMetadata: Record<string, any> & { processCodes?: ProcessCodeEntry[] };
  separationMethod: SeparationMethod;
  theme: ThemeType | null;
}

const CHUNK_CHARS = 250000; // UTF-16 문자 기준 (Firestore 문서 1MB 제한 대비)

function hashString(s: string): string {
  // FNV-1a 32bit 두 번 (앞/뒤 시드) → 16자리
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/* ---------------- IndexedDB (이 PC 보관) ---------------- */
const IDB_NAME = 'msec_snapshots';
const IDB_STORE = 'snapshots';

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(rec: { id: string; meta: SnapshotMeta; payload: string }): Promise<boolean> {
  const d = await openIdb();
  if (!d) return false;
  return new Promise(resolve => {
    try {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(rec);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet(id: string): Promise<{ id: string; meta: SnapshotMeta; payload: string } | null> {
  const d = await openIdb();
  if (!d) return null;
  return new Promise(resolve => {
    try {
      const req = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbListMetas(): Promise<SnapshotMeta[]> {
  const d = await openIdb();
  if (!d) return [];
  return new Promise(resolve => {
    try {
      const req = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).map((r: any) => r.meta));
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbDelete(id: string): Promise<void> {
  const d = await openIdb();
  if (!d) return;
  await new Promise<void>(resolve => {
    try {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

const cloudOn = () => isCloudConfigured && !isCloudQuotaExceeded();
export const isSnapshotCloudOn = cloudOn;

// 이 PC 저장본이 바뀌면 열린 목록을 새로 고침
const localListeners = new Set<() => void>();
const notifyLocalChange = () => localListeners.forEach(l => l());

/* ---------------- 저장 / 목록 / 불러오기 / 삭제 ---------------- */

export async function createSnapshot(args: {
  projectId: string;
  projectName: string;
  memo: string;
  kind: SnapshotKind;
  data: SnapshotData;
}): Promise<{ meta: SnapshotMeta; cloud: boolean; local: boolean }> {
  // 저장 시점 데이터를 깊은 복사로 고정
  const payloadJson = JSON.stringify(args.data);
  const payload = LZString.compressToUTF16(payloadJson);
  const hash = hashString(payloadJson);
  const items = args.data.items || [];
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const chunks = Math.max(1, Math.ceil(payload.length / CHUNK_CHARS));
  const meta: SnapshotMeta = {
    id,
    projectId: args.projectId,
    projectName: args.projectName,
    memo: args.memo.trim(),
    kind: args.kind,
    createdAt: Date.now(),
    itemCount: items.length,
    unclassifiedCount: items.filter(i => !i.category || i.category === '미분류').length,
    categoryCount: new Set(items.map(i => i.category).filter(Boolean)).size,
    totalAmount: items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    hash,
    chunks,
  };

  const local = await idbPut({ id, meta, payload });

  let cloud = false;
  if (cloudOn()) {
    try {
      for (let n = 0; n < chunks; n++) {
        await setDoc(doc(db, 'project_snapshot_data', `${id}_${n}`), {
          snapshotId: id,
          part: n,
          data: payload.slice(n * CHUNK_CHARS, (n + 1) * CHUNK_CHARS),
        });
      }
      // 본문을 모두 올린 다음 목록(메타)을 기록 → 목록에 보이면 항상 완전한 저장본
      await setDoc(doc(db, 'project_snapshots', id), meta);
      cloud = true;
    } catch (e) {
      console.warn('[저장본] 클라우드 저장 실패', e);
    }
  }

  if (!local && !cloud) throw new Error('저장본을 저장하지 못했습니다 (클라우드·PC 저장 모두 실패).');
  notifyLocalChange();
  return { meta: { ...meta, where: { cloud, local } }, cloud, local };
}

/** 저장본 목록 구독 (클라우드 + 이 PC 합침, 최신순) */
export function subscribeSnapshots(callback: (metas: SnapshotMeta[]) => void): () => void {
  let cloudMetas: SnapshotMeta[] = [];
  let localMetas: SnapshotMeta[] = [];
  let stopped = false;

  const emit = () => {
    if (stopped) return;
    const map = new Map<string, SnapshotMeta>();
    localMetas.forEach(m => map.set(m.id, { ...m, where: { cloud: false, local: true } }));
    cloudMetas.forEach(m => {
      const prev = map.get(m.id);
      map.set(m.id, { ...m, where: { cloud: true, local: !!prev } });
    });
    callback(Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt));
  };

  const refreshLocal = () => idbListMetas().then(list => { localMetas = list; emit(); });
  refreshLocal();
  localListeners.add(refreshLocal);

  let unsub = () => {};
  if (cloudOn()) {
    try {
      unsub = onSnapshot(
        query(collection(db, 'project_snapshots')),
        snap => {
          cloudMetas = snap.docs.map(d => d.data() as SnapshotMeta);
          refreshLocal();
        },
        err => console.warn('[저장본] 목록 구독 오류', err)
      );
    } catch (e) {
      console.warn('[저장본] 목록 구독 실패', e);
    }
  }
  return () => { stopped = true; localListeners.delete(refreshLocal); unsub(); };
}

/** 이 PC 목록만 다시 읽기 (저장 직후 갱신용) */
export async function listLocalSnapshotMetas(): Promise<SnapshotMeta[]> {
  return idbListMetas();
}

export async function loadSnapshot(meta: SnapshotMeta): Promise<{ data: SnapshotData; verified: boolean }> {
  let payload: string | null = null;
  const localRec = await idbGet(meta.id);
  if (localRec) payload = localRec.payload;

  if (!payload && isCloudConfigured) {
    const parts: string[] = [];
    for (let n = 0; n < (meta.chunks || 1); n++) {
      const snap = await getDoc(doc(db, 'project_snapshot_data', `${meta.id}_${n}`));
      if (!snap.exists()) throw new Error('저장본 본문 일부를 찾을 수 없습니다.');
      parts.push((snap.data() as any).data || '');
    }
    payload = parts.join('');
    // 다음에 빨리 열 수 있도록 이 PC에도 보관
    idbPut({ id: meta.id, meta, payload }).catch(() => {});
  }
  if (!payload) throw new Error('저장본 데이터를 찾을 수 없습니다.');

  const json = LZString.decompressFromUTF16(payload);
  if (!json) throw new Error('저장본 데이터를 해석할 수 없습니다.');
  const verified = hashString(json) === meta.hash;
  return { data: JSON.parse(json) as SnapshotData, verified };
}

export async function deleteSnapshot(meta: SnapshotMeta): Promise<void> {
  await idbDelete(meta.id);
  notifyLocalChange();
  if (isCloudConfigured && !isCloudQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'project_snapshots', meta.id));
      for (let n = 0; n < (meta.chunks || 1); n++) {
        await deleteDoc(doc(db, 'project_snapshot_data', `${meta.id}_${n}`));
      }
    } catch (e) {
      console.warn('[저장본] 클라우드 삭제 실패', e);
    }
  }
}
