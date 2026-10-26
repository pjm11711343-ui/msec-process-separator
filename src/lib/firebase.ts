import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  disableNetwork,
  setLogLevel
} from 'firebase/firestore';
import LZString from 'lz-string';
import { Project, SpecItem, CustomClassificationRule, ThemeType, AppConfig, LearnedMapping } from '../types';
// Firebase 설정은 .env 의 VITE_FIREBASE_* 값에서 읽습니다 (README 참고)
const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || ''
};

// Silence verbose internal Firestore backoff logging
try {
  setLogLevel('silent');
} catch (e) {}

// .env 에 Firebase 값이 없으면 클라우드 동기화 없이 로컬(브라우저 저장소) 모드로만 동작
export const isCloudConfigured = Boolean(config.projectId && config.apiKey);
if (!isCloudConfigured) {
  console.warn('[Firestore] .env 에 Firebase 설정이 없어 로컬 저장 모드로 동작합니다.');
  config.projectId = 'local-only';
  config.apiKey = 'local-only';
}

const { firestoreDatabaseId: _dbId, ...firebaseOptions } = config;
const app = getApps().length === 0 ? initializeApp(firebaseOptions) : getApps()[0];

export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Circuit breaker state for quota management
const STORAGE_QUOTA_KEY = 'firestore_quota_exceeded_timestamp';

let isQuotaExceeded = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_QUOTA_KEY) || sessionStorage.getItem(STORAGE_QUOTA_KEY);
    if (stored) {
      const ts = Number(stored);
      // Daily quota resets in 24 hours (86400000 ms)
      if (Date.now() - ts < 86400000) {
        // Automatically disable network on startup if already known to be exceeded
        try {
          disableNetwork(db).catch(() => {});
        } catch (e) {}
        return true;
      }
    }
  } catch (e) {}
  return false;
})();

let quotaListeners: ((exceeded: boolean) => void)[] = [];

export function isCloudQuotaExceeded(): boolean {
  return isQuotaExceeded || !isCloudConfigured;
}

export function onQuotaStateChange(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.push(listener);
  listener(isQuotaExceeded || !isCloudConfigured);
  return () => {
    quotaListeners = quotaListeners.filter(l => l !== listener);
  };
}

function notifyQuotaState(exceeded: boolean) {
  isQuotaExceeded = exceeded;
  try {
    if (exceeded) {
      localStorage.setItem(STORAGE_QUOTA_KEY, Date.now().toString());
      sessionStorage.setItem(STORAGE_QUOTA_KEY, Date.now().toString());
      // Immediately disable network to stop background backoff/retry noise
      disableNetwork(db).catch(() => {});
    } else {
      localStorage.removeItem(STORAGE_QUOTA_KEY);
      sessionStorage.removeItem(STORAGE_QUOTA_KEY);
    }
  } catch (e) {}
  quotaListeners.forEach(l => l(exceeded || !isCloudConfigured));
}

function checkQuotaState(): boolean {
  if (!isCloudConfigured) return false;
  if (isQuotaExceeded) {
    return false; // Skip Firestore calls when quota is exceeded
  }
  return true;
}

function handleFirestoreError(err: any, context: string): void {
  const errMsg = err?.message || String(err);
  const errCode = err?.code || '';
  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded')
  ) {
    if (!isQuotaExceeded) {
      console.warn(`[Firestore] Quota reached (${context}). Gracefully switching to local storage cache.`);
    }
    notifyQuotaState(true);
  } else {
    console.warn(`[Firestore] ${context} error:`, err);
  }
}

function sanitizeQuantity(val: any, amt: number, price: number, mAmt: number, mPrice: number, lAmt: number, lPrice: number, unit?: string): number {
  let q = typeof val === 'number' && !isNaN(val) ? val : (parseFloat(String(val || '').replace(/,/g, '')) || 0);
  if (q <= 0) {
    if (amt > 0 && price > 0) q = Math.round((amt / price) * 1000) / 1000;
    else if (mAmt > 0 && mPrice > 0) q = Math.round((mAmt / mPrice) * 1000) / 1000;
    else if (lAmt > 0 && lPrice > 0) q = Math.round((lAmt / lPrice) * 1000) / 1000;
    else {
      const cleanU = (unit || '').trim();
      if (amt > 0 && (cleanU === '식' || cleanU === 'set' || cleanU === 'lot' || cleanU === '개소' || price === amt || price === 0)) {
        q = 1;
      }
    }
  }
  return q;
}

// Helper to serialize SpecItems safely for Firestore
function serializeItems(items: SpecItem[]): { items?: any[]; itemsCompressed?: string } {
  if (!items || items.length === 0) {
    return { items: [] };
  }

  // Sanitize undefined values
  const cleanItems = items.map(item => {
    const amt = typeof item.amount === 'number' ? item.amount : (parseFloat(String(item.amount).replace(/,/g, '')) || 0);
    const prc = typeof item.unitPrice === 'number' ? item.unitPrice : (parseFloat(String(item.unitPrice).replace(/,/g, '')) || 0);
    const mAmt = typeof item.materialAmount === 'number' ? item.materialAmount : 0;
    const mPrc = typeof item.materialUnitPrice === 'number' ? item.materialUnitPrice : 0;
    const lAmt = typeof item.laborAmount === 'number' ? item.laborAmount : 0;
    const lPrc = typeof item.laborUnitPrice === 'number' ? item.laborUnitPrice : 0;
    const finalQty = sanitizeQuantity(item.quantity, amt, prc, mAmt, mPrc, lAmt, lPrc, item.unit);

    return {
      id: item.id || '',
      name: item.name || '',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: finalQty,
      materialUnitPrice: mPrc,
      materialAmount: mAmt,
      laborUnitPrice: lPrc,
      laborAmount: lAmt,
      unitPrice: prc,
      amount: amt,
      category: item.category || '미분류',
      section: item.section || '기타 공정',
      remark: item.remark || '',
      originalCategory: item.originalCategory || item.category || '미분류',
      excelRowIdx: typeof item.excelRowIdx === 'number' ? item.excelRowIdx : null,
      memo: item.memo || '',
      executionAmount: typeof item.executionAmount === 'number' ? item.executionAmount : 0,
      ...(typeof item.sectionParent === 'string' ? { sectionParent: item.sectionParent } : {})
    };
  });

  const jsonStr = JSON.stringify(cleanItems);
  // If data is relatively large (> 400KB), store compressed
  if (jsonStr.length > 300000) {
    const compressed = LZString.compressToUTF16(jsonStr);
    return { itemsCompressed: compressed };
  }

  return { items: cleanItems };
}

// Helper to deserialize SpecItems
function deserializeItems(data: any): SpecItem[] {
  let rawList: any[] = [];
  if (data.itemsCompressed) {
    try {
      const decompressed = LZString.decompressFromUTF16(data.itemsCompressed);
      if (decompressed) {
        rawList = JSON.parse(decompressed);
      }
    } catch (e) {
      console.error('Failed to decompress items from Firestore', e);
    }
  } else if (Array.isArray(data.items)) {
    rawList = data.items;
  }

  return rawList.map((item: any) => {
    const amt = Number(item.amount) || 0;
    const prc = Number(item.unitPrice) || 0;
    const mAmt = Number(item.materialAmount) || 0;
    const mPrc = Number(item.materialUnitPrice) || 0;
    const lAmt = Number(item.laborAmount) || 0;
    const lPrc = Number(item.laborUnitPrice) || 0;
    const finalQty = sanitizeQuantity(item.quantity, amt, prc, mAmt, mPrc, lAmt, lPrc, item.unit);

    return {
      id: item.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
      name: item.name || '',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: finalQty,
      materialUnitPrice: mPrc,
      materialAmount: mAmt,
      laborUnitPrice: lPrc,
      laborAmount: lAmt,
      unitPrice: prc,
      amount: amt,
      category: item.category || '미분류',
      section: item.section || '기타 공정',
      remark: item.remark || '',
      originalCategory: item.originalCategory || item.category,
      excelRowIdx: typeof item.excelRowIdx === 'number' ? item.excelRowIdx : undefined,
      memo: item.memo || '',
      executionAmount: Number(item.executionAmount) || 0,
      ...(typeof item.sectionParent === 'string' ? { sectionParent: item.sectionParent } : {})
    };
  });
}

/**
 * 1. Save or update project in Firestore
 */
export async function saveProjectToFirestore(project: Project): Promise<void> {
  if (!checkQuotaState()) return;
  if (!project.id && !project.name) return;

  try {
    const docId = project.id || encodeURIComponent(project.name.trim());
    const projectRef = doc(db, 'projects', docId);

    const { items: serializedItems, itemsCompressed } = serializeItems(project.items || []);

    const dataToSave: any = {
      id: docId,
      name: project.name,
      theme: project.theme || 'high-density',
      config: project.config || {
        theme: project.theme || 'high-density',
        fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif',
        fontSize: 15
      },
      categories: project.categories || [],
      updatedAt: project.updatedAt || Date.now(),
      status: project.status || 'working',
      categoryEstimates: project.categoryEstimates || {},
      // 현장 기본정보 (착공일·준공일·동수·세대수·층수) 및 집계 방식도 함께 저장
      commencementDate: project.commencementDate || '',
      completionDate: project.completionDate || '',
      buildingCount: project.buildingCount || '',
      householdCount: project.householdCount || '',
      highestFloor: project.highestFloor || '',
      lowestFloor: project.lowestFloor || '',
      separationMethod: project.separationMethod || 'method2',
      processCodes: project.processCodes || [],
      itemCount: project.items?.length || 0,
      serverSyncedAt: serverTimestamp()
    };

    if (itemsCompressed) {
      dataToSave.itemsCompressed = itemsCompressed;
      dataToSave.items = [];
    } else {
      dataToSave.items = serializedItems || [];
    }

    await setDoc(projectRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveProject');
  }
}

/**
 * 2. Delete project from Firestore
 */
export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  if (!checkQuotaState()) return;
  if (!projectId) return;

  try {
    const projectRef = doc(db, 'projects', projectId);
    await deleteDoc(projectRef);
  } catch (err) {
    handleFirestoreError(err, 'deleteProject');
  }
}

/**
 * 3. Subscribe to real-time project list from Firestore
 */
export function subscribeProjectsFromFirestore(callback: (projects: Project[]) => void): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const projectsCol = collection(db, 'projects');
    const q = query(projectsCol);

    return onSnapshot(
      q,
      snapshot => {
        const projects: Project[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const items = deserializeItems(data);
          projects.push({
            id: docSnap.id,
            name: data.name || '무제 현장',
            items,
            theme: data.theme || 'high-density',
            config: data.config,
            categories: data.categories || [],
            categoryEstimates: data.categoryEstimates || {},
            commencementDate: data.commencementDate,
            completionDate: data.completionDate,
            buildingCount: data.buildingCount,
            householdCount: data.householdCount,
            highestFloor: data.highestFloor,
            lowestFloor: data.lowestFloor,
            separationMethod: data.separationMethod || 'method2',
            processCodes: Array.isArray(data.processCodes) ? data.processCodes : [],
            updatedAt: data.updatedAt || Date.now(),
            status: data.status || 'working'
          });
        });

        // Sort by updatedAt descending
        projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(projects);
      },
      error => {
        handleFirestoreError(error, 'project subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup project subscription');
    return () => {};
  }
}

/**
 * 4. Save active global session to Firestore (so any new PC opening gets the exact latest state)
 */
export async function saveActiveSessionToFirestore(session: {
  projectName: string;
  items: SpecItem[];
  theme: ThemeType | null;
  fontFamily: string;
  fontSize: number;
  categories: string[];
  categoryEstimates?: Record<string, number>;
  isLocked?: boolean;
  commencementDate?: string;
  completionDate?: string;
  buildingCount?: string;
  householdCount?: string;
  highestFloor?: string;
  lowestFloor?: string;
  processCodes?: { code: string; name: string }[];
}): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const sessionRef = doc(db, 'app_state', 'latest_active_session');
    const { items: serializedItems, itemsCompressed } = serializeItems(session.items || []);

    const dataToSave: any = {
      projectName: session.projectName || '',
      theme: session.theme || null,
      fontFamily: session.fontFamily || '"Malgun Gothic", "맑은 고딕", sans-serif',
      fontSize: session.fontSize || 15,
      categories: session.categories || [],
      categoryEstimates: session.categoryEstimates || {},
      commencementDate: session.commencementDate || '',
      completionDate: session.completionDate || '',
      buildingCount: session.buildingCount || '',
      householdCount: session.householdCount || '',
      highestFloor: session.highestFloor || '',
      lowestFloor: session.lowestFloor || '',
      processCodes: session.processCodes || [],
      isLocked: !!session.isLocked,
      itemCount: session.items?.length || 0,
      updatedAt: Date.now(),
      serverSyncedAt: serverTimestamp()
    };

    if (itemsCompressed) {
      dataToSave.itemsCompressed = itemsCompressed;
      dataToSave.items = [];
    } else {
      dataToSave.items = serializedItems || [];
    }

    await setDoc(sessionRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveActiveSession');
  }
}

/**
 * 5. Fetch or subscribe active session from Firestore
 */
export function subscribeActiveSessionFromFirestore(
  callback: (session: {
    projectName: string;
    items: SpecItem[];
    theme: ThemeType | null;
    fontFamily: string;
    fontSize: number;
    categories: string[];
    categoryEstimates: Record<string, number>;
    isLocked: boolean;
    commencementDate?: string;
    completionDate?: string;
    buildingCount?: string;
    householdCount?: string;
    highestFloor?: string;
    lowestFloor?: string;
    processCodes?: { code: string; name: string }[];
    updatedAt: number;
  } | null) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const sessionRef = doc(db, 'app_state', 'latest_active_session');

    return onSnapshot(
      sessionRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const items = deserializeItems(data);
          callback({
            projectName: data.projectName || '',
            items,
            theme: data.theme || null,
            fontFamily: data.fontFamily || '"Malgun Gothic", "맑은 고딕", sans-serif',
            fontSize: data.fontSize || 15,
            categories: data.categories || [],
            categoryEstimates: data.categoryEstimates || {},
            isLocked: !!data.isLocked,
            commencementDate: data.commencementDate,
            completionDate: data.completionDate,
            buildingCount: data.buildingCount,
            householdCount: data.householdCount,
            highestFloor: data.highestFloor,
            lowestFloor: data.lowestFloor,
            processCodes: Array.isArray(data.processCodes) ? data.processCodes : [],
            updatedAt: data.updatedAt || 0
          });
        } else {
          callback(null);
        }
      },
      error => {
        handleFirestoreError(error, 'active session subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup active session subscription');
    return () => {};
  }
}

/**
 * 6. Custom classification rules syncing across PCs
 */
export async function saveCustomRulesToFirestore(rules: CustomClassificationRule[]): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const rulesRef = doc(db, 'app_settings', 'custom_rules');
    await setDoc(rulesRef, {
      rules: rules || [],
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, 'saveCustomRules');
  }
}

export function subscribeCustomRulesFromFirestore(
  callback: (rules: CustomClassificationRule[], updatedAt?: number) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const rulesRef = doc(db, 'app_settings', 'custom_rules');
    return onSnapshot(
      rulesRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.rules)) {
            callback(data.rules, data.updatedAt);
          }
        }
      },
      error => {
        handleFirestoreError(error, 'rules subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup rules subscription');
    return () => {};
  }
}

/**
 * 7. Custom Categories syncing across sessions and devices
 */
export async function saveCategoriesToFirestore(categories: string[]): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const catRef = doc(db, 'app_settings', 'categories');
    await setDoc(catRef, {
      categories: categories || [],
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveCategories');
  }
}

export async function saveCategoryColorsToFirestore(colors: Record<string, string>): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const catRef = doc(db, 'app_settings', 'categories');
    await setDoc(catRef, {
      categoryColors: colors || {},
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, 'saveCategoryColors');
  }
}

export function subscribeCategoriesFromFirestore(
  callback: (categories: string[], colors: Record<string, string>) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const catRef = doc(db, 'app_settings', 'categories');
    return onSnapshot(
      catRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const categories = Array.isArray(data.categories) ? data.categories : [];
          const colors = data.categoryColors || {};
          callback(categories, colors);
        }
      },
      error => {
        handleFirestoreError(error, 'categories subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup categories subscription');
    return () => {};
  }
}

/**
 * 8. Global UI configuration (Font Size, Family, etc.)
 */
export async function saveGlobalUIConfigToFirestore(config: {
  fontFamily: string;
  fontSize: number;
}): Promise<void> {
  if (!checkQuotaState()) return;

  try {
    const uiRef = doc(db, 'app_settings', 'ui_config');
    await setDoc(uiRef, {
      ...config,
      version: 2,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, 'saveGlobalUIConfig');
  }
}

export function subscribeGlobalUIConfigFromFirestore(
  callback: (config: { fontFamily: string; fontSize: number; version?: number }) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const uiRef = doc(db, 'app_settings', 'ui_config');
    return onSnapshot(
      uiRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fontFamily && data.fontSize) {
            callback({
              fontFamily: data.fontFamily,
              fontSize: data.fontSize,
              version: data.version || 0
            });
          }
        }
      },
      error => {
        handleFirestoreError(error, 'ui config subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup ui config subscription');
    return () => {};
  }
}

/**
 * 9. Learned classification mappings (Classification Recommendation Service)
 */
export async function saveLearnedMappingToFirestore(mapping: {
  name: string;
  specification: string;
  category: string;
}): Promise<void> {
  if (!checkQuotaState()) return;
  if (!mapping.name || !mapping.category) return;

  try {
    const id = encodeURIComponent(`${mapping.name.trim()}_${mapping.specification.trim()}`);
    const mappingRef = doc(db, 'learned_mappings', id);
    const docSnap = await getDoc(mappingRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      await setDoc(mappingRef, {
        name: mapping.name.trim(),
        specification: mapping.specification.trim(),
        category: mapping.category,
        hitCount: (data.hitCount || 0) + 1,
        lastUpdatedAt: Date.now()
      }, { merge: true });
    } else {
      await setDoc(mappingRef, {
        name: mapping.name.trim(),
        specification: mapping.specification.trim(),
        category: mapping.category,
        hitCount: 1,
        lastUpdatedAt: Date.now()
      });
    }
  } catch (err) {
    handleFirestoreError(err, 'saveLearnedMapping');
  }
}

export function subscribeLearnedMappingsFromFirestore(
  callback: (mappings: Record<string, string>) => void
): () => void {
  if (!checkQuotaState()) {
    return () => {};
  }
  try {
    const mappingsCol = collection(db, 'learned_mappings');
    return onSnapshot(
      mappingsCol,
      snapshot => {
        const mappings: Record<string, string> = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const key = `${data.name}_${data.specification}`;
          mappings[key] = data.category;
        });
        callback(mappings);
      },
      error => {
        handleFirestoreError(error, 'learned mappings subscription');
      }
    );
  } catch (err) {
    handleFirestoreError(err, 'setup learned mappings subscription');
    return () => {};
  }
}

/**
 * 10. 현장 단위 분류 학습 (learned_sites/{projectId}) — 현장마다 1문서, 다시 학습하면 덮어씀
 */
export async function saveSiteLearningToFirestore(site: {
  projectId: string;
  projectName: string;
  learnedAt: number;
  itemCount: number;
  keyCount: number;
  votes: Record<string, Record<string, number>>;
}): Promise<void> {
  if (!checkQuotaState()) return;
  try {
    const ref = doc(db, 'learned_sites', site.projectId);
    await setDoc(ref, {
      projectId: site.projectId,
      projectName: site.projectName,
      learnedAt: site.learnedAt,
      itemCount: site.itemCount,
      keyCount: site.keyCount,
      votesCompressed: LZString.compressToUTF16(JSON.stringify(site.votes || {}))
    });
  } catch (err) {
    handleFirestoreError(err, 'saveSiteLearning');
  }
}

export async function deleteSiteLearningFromFirestore(projectId: string): Promise<void> {
  if (!checkQuotaState()) return;
  try {
    await deleteDoc(doc(db, 'learned_sites', projectId));
  } catch (err) {
    handleFirestoreError(err, 'deleteSiteLearning');
  }
}

export function subscribeSiteLearningsFromFirestore(
  callback: (sites: { projectId: string; projectName: string; learnedAt: number; itemCount: number; keyCount: number; votes: Record<string, Record<string, number>> }[]) => void
): () => void {
  if (!checkQuotaState()) return () => {};
  try {
    return onSnapshot(
      collection(db, 'learned_sites'),
      snapshot => {
        const sites: any[] = [];
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          let votes = {};
          try {
            const raw = d.votesCompressed ? LZString.decompressFromUTF16(d.votesCompressed) : '';
            votes = raw ? JSON.parse(raw) : {};
          } catch (e) {
            console.warn('Failed to read learned site', docSnap.id, e);
          }
          sites.push({
            projectId: d.projectId || docSnap.id,
            projectName: d.projectName || '',
            learnedAt: d.learnedAt || 0,
            itemCount: d.itemCount || 0,
            keyCount: d.keyCount || 0,
            votes
          });
        });
        callback(sites);
      },
      error => handleFirestoreError(error, 'learned sites subscription')
    );
  } catch (err) {
    handleFirestoreError(err, 'setup learned sites subscription');
    return () => {};
  }
}
