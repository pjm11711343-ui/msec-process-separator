/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SpecItem, ThemeType, Project, CustomClassificationRule, INITIAL_CATEGORIES, SeparationMethod } from './types';
import { autoClassify } from './utils/classifier';
import { exportStyledExcel } from './utils/excelExport';
import { healItem } from './utils/costCalculation';
import { recordRuleExecutionFeedback } from './utils/patternAnalytics';
import { normalizeAllItemsSections, formatSectionWithHierarchy, buildSectionDisplayInfo } from './utils/sectionHierarchy';
import TemplateSelector from './components/TemplateSelector';
import Dashboard from './components/Dashboard';
import SectionSummaryCards from './components/SectionSummaryCards';
import CategorySummaryCards from './components/CategorySummaryCards';
import DataTable from './components/DataTable';
import PriceAnalysis from './components/PriceAnalysis';
import AIAnalysisDrawer from './components/AIAnalysisDrawer';
import CategoryMatrixView from './components/CategoryMatrixView';
import ExcelUpload from './components/ExcelUpload';
import CategoryManager from './components/CategoryManager';
import SettingsManager from './components/SettingsManager';
import ProjectSiteManager from './components/ProjectSiteManager';
import SiteListSidebar from './components/SiteListSidebar';
import { Settings, FileSpreadsheet, LogOut, ChevronRight, Tags, BarChart3, Download, Share2, Copy, Check, X, Save, Lock, KeySquare, Sliders, Cloud, CheckCircle2, RefreshCw, Menu, Database, AlertCircle, Layers, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  subscribeProjectsFromFirestore,
  saveActiveSessionToFirestore,
  subscribeActiveSessionFromFirestore,
  saveCustomRulesToFirestore,
  subscribeCustomRulesFromFirestore,
  saveCategoriesToFirestore,
  saveCategoryColorsToFirestore,
  subscribeCategoriesFromFirestore,
  saveGlobalUIConfigToFirestore,
  subscribeGlobalUIConfigFromFirestore,
  saveLearnedMappingToFirestore,
  subscribeLearnedMappingsFromFirestore,
  isCloudQuotaExceeded,
  onQuotaStateChange
} from './lib/firebase';

import * as XLSX from 'xlsx';
import LZString from 'lz-string';

const CATEGORIES_KEY = 'mechauto_categories';
const STORAGE_KEY = 'mechauto_session_data';
const PROJECTS_KEY = 'mechauto_projects';

// Improved safe storage with automatic compression for large payloads
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      let dataToStore = value;
      // Compress if larger than 50KB
      if (value.length > 50000) {
        try {
          const compressed = LZString.compressToEncodedURIComponent(value);
          if (compressed) {
            dataToStore = 'lz:' + compressed;
          }
        } catch (e) {
          console.warn(`Compression failed for ${key}, storing raw`, e);
        }
      }
      localStorage.setItem(key, dataToStore);
      return true;
    } catch (e) {
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`LocalStorage quota exceeded for ${key}. Data not saved locally.`);
        // Try a last-ditch effort: if it's the projects list, maybe clear the session data first
        if (key === PROJECTS_KEY) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
        }
      } else {
        console.error(`LocalStorage error for ${key}:`, e);
      }
      return false;
    }
  },
  getItem: (key: string): string | null => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      if (saved.startsWith('lz:')) {
        try {
          const decompressed = LZString.decompressFromEncodedURIComponent(saved.slice(3));
          return decompressed || null;
        } catch (e) {
          console.error(`Failed to decompress ${key}:`, e);
          return null;
        }
      }
      return saved;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return null;
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

const SAMPLE_ITEMS: SpecItem[] = [
  // 옥외배관공사
  { id: 'bw-1', name: 'STS 유니온 (나사)', specification: 'D 40', unit: 'EA', quantity: 1, materialUnitPrice: 14010, materialAmount: 14010, laborUnitPrice: 0, laborAmount: 0, unitPrice: 14010, amount: 14010, category: 'STS위생부속', section: '010102 옥외배관공사', remark: '' },
  { id: 'bw-2', name: 'STS 니플 (나사)', specification: 'D 40', unit: 'EA', quantity: 3, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 0, laborAmount: 0, unitPrice: 0, amount: 0, category: '지금자재', section: '010102 옥외배관공사', remark: '지급자재' },
  { id: 'bw-3', name: 'STS 후렌지접합', specification: 'D 40', unit: '개소', quantity: 1, materialUnitPrice: 0, materialAmount: 0, laborUnitPrice: 22620, laborAmount: 22620, unitPrice: 0, amount: 0, category: '미분류', section: '010102 옥외배관공사', remark: '' },
  
  // 세대내 난방 배관공사 (01010401 계층 구조)
  { id: 'hb-1', name: '폴리부틸렌관 (난방용)', specification: 'PB, D15', unit: 'M', quantity: 120, materialUnitPrice: 1850, materialAmount: 222000, laborUnitPrice: 1200, laborAmount: 144000, unitPrice: 3050, amount: 366000, category: '난방코일', section: '0101040101  세대내 난방 배관공사 59㎡ 단위세대', remark: '' },
  { id: 'hb-2', name: '폴리부틸렌관 (난방용)', specification: 'PB, D15', unit: 'M', quantity: 154, materialUnitPrice: 1850, materialAmount: 284900, laborUnitPrice: 1200, laborAmount: 184800, unitPrice: 3050, amount: 469700, category: '난방코일', section: '0101040102  세대내 난방 배관공사 76㎡ 단위세대', remark: '' },
  { id: 'hb-3', name: '폴리부틸렌관 (난방용)', specification: 'PB, D15', unit: 'M', quantity: 172, materialUnitPrice: 1850, materialAmount: 318200, laborUnitPrice: 1200, laborAmount: 206400, unitPrice: 3050, amount: 524600, category: '난방코일', section: '0101040103  세대내 난방 배관공사 84㎡ 단위세대', remark: '' },
  { id: 'hb-4', name: '폴리부틸렌관 (난방용)', specification: 'PB, D15', unit: 'M', quantity: 195, materialUnitPrice: 1850, materialAmount: 360750, laborUnitPrice: 1200, laborAmount: 234000, unitPrice: 3050, amount: 594750, category: '난방코일', section: '0101040104  세대내 난방 배관공사 95㎡ 단위세대', remark: '' },

  // 세대내 위생 배관공사 (01010402 계층 구조)
  { id: 'wb-1', name: '이중관 PB파이프 (급수용)', specification: 'PB, D16', unit: 'M', quantity: 85, materialUnitPrice: 2100, materialAmount: 178500, laborUnitPrice: 1500, laborAmount: 127500, unitPrice: 3600, amount: 306000, category: 'PB', section: '0101040201  세대내 위생 배관공사 59㎡ 단위세대', remark: '' },
  { id: 'wb-2', name: '이중관 PB파이프 (급수용)', specification: 'PB, D16', unit: 'M', quantity: 110, materialUnitPrice: 2100, materialAmount: 231000, laborUnitPrice: 1500, laborAmount: 165000, unitPrice: 3600, amount: 396000, category: 'PB', section: '0101040202  세대내 위생 배관공사 76㎡ 단위세대', remark: '' },
  { id: 'wb-3', name: '이중관 PB파이프 (급수용)', specification: 'PB, D16', unit: 'M', quantity: 125, materialUnitPrice: 2100, materialAmount: 262500, laborUnitPrice: 1500, laborAmount: 187500, unitPrice: 3600, amount: 450000, category: 'PB', section: '0101040203  세대내 위생 배관공사 84㎡ 단위세대', remark: '' },

  // 기계실 난방 배관공사 (01010501 계층 구조)
  { id: 'ms-1', name: 'STS 엘보 (SR)', specification: 'D 25', unit: 'EA', quantity: 32, materialUnitPrice: 2769, materialAmount: 88608, laborUnitPrice: 0, laborAmount: 0, unitPrice: 2769, amount: 88608, category: 'STS위생부속', section: '0101050101  기계실 난방 배관공사 난방헤더 및 주위배관', remark: '에폭시코팅' },
  { id: 'ms-2', name: 'STS 숫아답타소켓 (SR)', specification: 'D 25', unit: 'EA', quantity: 22, materialUnitPrice: 4356, materialAmount: 95832, laborUnitPrice: 0, laborAmount: 0, unitPrice: 4356, amount: 95832, category: 'STS위생부속', section: '0101050102  기계실 난방 배관공사 순환펌프주위', remark: '' },
  { id: 'ms-3', name: 'STS K-유니온 (SR)', specification: 'D 25', unit: 'EA', quantity: 18, materialUnitPrice: 10704, materialAmount: 192672, laborUnitPrice: 0, laborAmount: 0, unitPrice: 10704, amount: 192672, category: 'STS위생부속', section: '0101050102  기계실 난방 배관공사 순환펌프주위', remark: '' },
];

// Field mappings for SpecItem compaction
const FIELD_MAP: Record<string, string> = {
  id: 'i',
  name: 'n',
  specification: 's',
  unit: 'u',
  quantity: 'q',
  materialUnitPrice: 'm',
  materialAmount: 'ma',
  laborUnitPrice: 'l',
  laborAmount: 'la',
  unitPrice: 'p',
  amount: 'a',
  category: 'c',
  section: 't',
  remark: 'r',
  originalCategory: 'o',
  excelRowIdx: 'x',
  memo: 'mo'
};

const REVERSE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

function minifyState(items: SpecItem[], theme: string | null, categories: string[], projectName: string, fontFamily: string, fontSize: number) {
  const minifiedItems = items.map(item => {
    const minItem: Record<string, any> = {};
    for (const [key, value] of Object.entries(item)) {
      const shortKey = FIELD_MAP[key] || key;
      minItem[shortKey] = value;
    }
    return minItem;
  });

  return {
    its: minifiedItems,
    th: theme,
    ff: fontFamily,
    fs: fontSize,
    cats: categories,
    pName: projectName
  };
}

function unminifyState(minState: any) {
  const items = (minState.its || []).map((minItem: any) => {
    const item: Record<string, any> = {};
    for (const [key, value] of Object.entries(minItem)) {
      const longKey = REVERSE_FIELD_MAP[key] || key;
      item[longKey] = value;
    }
    return healItem(item as SpecItem);
  });

  return {
    items,
    theme: minState.th,
    fontFamily: minState.ff || '"Gulim", "굴림", Dotum, "돋움", sans-serif',
    fontSize: minState.fs || 11,
    categories: minState.cats,
    projectName: minState.pName
  };
}

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
  return btoa(binString);
}

async function compressState(stateObj: any): Promise<string> {
  const jsonStr = JSON.stringify(stateObj);
  try {
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    if (compressed) {
      return 'lz:' + compressed;
    }
  } catch (e) {
    console.warn("lz-string compression failed, falling back to older raw encoding", e);
  }

  try {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([jsonStr]).stream();
      // @ts-ignore
      const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
      const chunks: BlobPart[] = [];
      const reader = compressedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks);
      const buffer = await blob.arrayBuffer();
      const b64 = bytesToBase64(new Uint8Array(buffer));
      return 'gz:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  } catch (e) {
    console.warn("CompressionStream failed, falling back to standard encoding", e);
  }
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  const b64 = bytesToBase64(utf8Bytes);
  return 'raw:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressState(encoded: string): Promise<any> {
  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch (e) {
    // ignore
  }

  // 1. New lz-string decompression
  if (decoded.startsWith('lz:')) {
    const rawPayload = decoded.slice(3);
    const decompressed = LZString.decompressFromEncodedURIComponent(rawPayload);
    if (decompressed) {
      return JSON.parse(decompressed);
    }
    throw new Error("Failed to decompress using lz-string");
  }

  // 2. Old backward compatible fallback
  let isGzip = false;
  let cleanB64 = decoded;
  if (decoded.startsWith('gz:')) {
    isGzip = true;
    cleanB64 = decoded.slice(3);
  } else if (decoded.startsWith('raw:')) {
    isGzip = false;
    cleanB64 = decoded.slice(4);
  }

  let base64 = cleanB64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  const bytes = base64ToBytes(base64);

  if (isGzip && typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes]).stream();
      // @ts-ignore
      const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
      const chunks: BlobPart[] = [];
      const reader = decompressedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks);
      const text = await blob.text();
      return JSON.parse(text);
    } catch (e) {
      console.warn("DecompressionStream failed, fallback to standard decoding", e);
    }
  }

  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

import ProjectComparisonModal from './components/ProjectComparisonModal.tsx';

export default function App() {
  const [theme, setTheme] = useState<ThemeType | null>(null);
  const [fontFamily, setFontFamily] = useState<string>('"Gulim", "굴림", Dotum, "돋움", sans-serif');
  const [fontSize, setFontSize] = useState<number>(11);
  const [items, setItems] = useState<SpecItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'matrix' | 'analysis'>('list');
  const [separationMethod, setSeparationMethod] = useState<SeparationMethod>('method2');
  const [isAIAnalysisDrawerOpen, setIsAIAnalysisDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem(CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(c => typeof c === 'string' && c.trim().length > 0);
          if (clean.length > 0) {
            return clean;
          }
        }
      }
    } catch (e) {
      console.error('Error loading saved categories:', e);
    }
    return INITIAL_CATEGORIES;
  });

  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(() => {
    try {
      const saved = safeLocalStorage.getItem('mechauto_category_colors');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading category colors:', e);
    }
    return {};
  });

  const [categoryManagerTab, setCategoryManagerTab] = useState<'categories' | 'rules' | 'patternStats' | 'stats'>('categories');

  // Persist categories to local storage
  useEffect(() => {
    if (categories && categories.length > 0) {
      safeLocalStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
  }, [categories]);

  // Persist category colors to local storage
  useEffect(() => {
    if (categoryColors && Object.keys(categoryColors).length > 0) {
      safeLocalStorage.setItem('mechauto_category_colors', JSON.stringify(categoryColors));
    }
  }, [categoryColors]);

  const handleUpdateCategoryList = (newCategories: string[]) => {
    setCategories(newCategories);
    saveCategoriesToFirestore(newCategories).catch(err => {
      console.warn('Failed to sync categories to Firestore:', err);
    });
  };

  const handleUpdateCategoryColors = (newColors: Record<string, string>) => {
    setCategoryColors(newColors);
    saveCategoryColorsToFirestore(newColors).catch(err => {
      console.warn('Failed to sync category colors to Firestore:', err);
    });
  };

  const mergeClassificationRules = (
    existingRules: CustomClassificationRule[],
    incomingRules: CustomClassificationRule[]
  ): CustomClassificationRule[] => {
    const ruleMap = new Map<string, CustomClassificationRule>();
    const getKey = (r: CustomClassificationRule) => (r.pattern || '').trim().toLowerCase().replace(/\s+/g, '');

    // 1. Existing local rules take precedence
    (existingRules || []).forEach(r => {
      if (!r || !r.pattern) return;
      const key = getKey(r);
      if (key) ruleMap.set(key, r);
    });

    // 2. Incoming rules merge if not present
    (incomingRules || []).forEach(r => {
      if (!r || !r.pattern) return;
      const key = getKey(r);
      if (!key) return;

      if (!ruleMap.has(key)) {
        ruleMap.set(key, r);
      } else {
        const existing = ruleMap.get(key)!;
        ruleMap.set(key, {
          ...existing,
          ...r,
          priority: Math.max(existing.priority ?? 10, r.priority ?? 10)
        });
      }
    });

    return Array.from(ruleMap.values());
  };

  const [customClassificationRules, setCustomClassificationRules] = useState<CustomClassificationRule[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('mechauto_custom_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({
            ...r,
            priority: typeof r.priority === 'number' ? r.priority : 10
          }));
        }
      }
    } catch (e) {
      console.error('Error loading custom rules:', e);
    }
    return [
      { id: 'rule-sample-1', pattern: '소음방지', category: 'PB', isEnabled: true, priority: 20, description: '소음방지 키워드 매칭 기본 규칙' },
      { id: 'rule-sample-2', pattern: '안전보호구', category: '지금자재', isEnabled: true, priority: 10, description: '안전 장비 및 수동 보호구 자동 지금자재 처리용' }
    ];
  });

  const [learnedMappings, setLearnedMappings] = useState<Record<string, string>>(() => {
    try {
      const saved = safeLocalStorage.getItem('mechauto_learned_mappings');
      if (saved) {
        return JSON.parse(saved) || {};
      }
    } catch (e) {
      console.error('Error loading learned mappings from localStorage:', e);
    }
    return {};
  });

  // Persist classification rules to local storage
  useEffect(() => {
    safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(customClassificationRules));
    safeLocalStorage.setItem('mechauto_custom_rules_updated_at', Date.now().toString());
  }, [customClassificationRules]);

  // Persist learned mappings to local storage
  useEffect(() => {
    safeLocalStorage.setItem('mechauto_learned_mappings', JSON.stringify(learnedMappings));
  }, [learnedMappings]);

  const handleUpdateRules = (newRules: CustomClassificationRule[]) => {
    setCustomClassificationRules(newRules);
    safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(newRules));
    safeLocalStorage.setItem('mechauto_custom_rules_updated_at', Date.now().toString());
    saveCustomRulesToFirestore(newRules).catch(err => {
      console.warn('Failed to sync rules to Firestore:', err);
    });
  };

  const handleApplyRules = (updatedRules = customClassificationRules) => {
    if (items.length === 0) {
      showNotification('적용할 시트 데이터가 없습니다. 먼저 엑셀 파일을 업로드해 주세요.', 'error');
      return;
    }
    
    checkLockAndProceed(() => {
      let changedCount = 0;
      setItems(prevItems => {
        const sectionInfo = buildSectionDisplayInfo(prevItems);
        return prevItems.map(item => {
          const withParent = item.sectionParent !== undefined
            ? item
            : { ...item, sectionParent: sectionInfo.get(item.id)?.parents.join(' › ') || '' };
          const { category: newCategory, remark } = autoClassify(withParent, updatedRules);
          const finalCategory = newCategory || item.category;
          if (finalCategory !== item.category) {
            changedCount++;
            return {
              ...item,
              category: finalCategory,
              originalCategory: finalCategory,
              remark: remark || item.remark
            };
          }
          return item;
        });
      });
      showNotification(`분류 규칙 일괄 적용 완료! ${changedCount}개의 품목 카테고리가 재조정되었습니다.`, 'success');
    });
  };

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSectionSummaryOpen, setIsSectionSummaryOpen] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Project Management State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  
  // Cloud & Local Sync Status
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastCloudSyncedTime, setLastCloudSyncedTime] = useState<string>('');
  const [isAutoSavingIndicator, setIsAutoSavingIndicator] = useState(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>('');
  const [isAutoSaveActive, setIsAutoSaveActive] = useState(true);
  const [isManualSaveNamingOpen, setIsManualSaveNamingOpen] = useState(false);
  const [manualSaveName, setManualSaveName] = useState('');
  const [isQuotaExceededState, setIsQuotaExceededState] = useState<boolean>(isCloudQuotaExceeded());
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState<boolean>(false);
  const [isLocalStorageQuotaExceeded, setIsLocalStorageQuotaExceeded] = useState<boolean>(false);
  
  const [categoryEstimates, setCategoryEstimates] = useState<Record<string, number>>({});
  
  const [projectMetadata, setProjectMetadata] = useState<{
    commencementDate?: string;
    completionDate?: string;
    buildingCount?: string;
    householdCount?: string;
    highestFloor?: string;
    lowestFloor?: string;
  }>({});

  const handleUpdateProjectMetadata = (key: string, value: string) => {
    setProjectMetadata(prev => {
      const updated = {
        ...prev,
        [key]: value
      };
      
      // Update local storage session
      const sessionData = safeLocalStorage.getItem(STORAGE_KEY);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          parsed.projectMetadata = updated;
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {
          console.warn('Failed to update local storage for project metadata', e);
        }
      }
      
      return updated;
    });
  };

  // Update manual estimate for a specific category
  const handleUpdateCategoryEstimate = (category: string, amount: number) => {
    setCategoryEstimates(prev => {
      const updated = {
        ...prev,
        [category]: amount
      };
      
      // Update local storage
      const sessionData = safeLocalStorage.getItem(STORAGE_KEY);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          parsed.categoryEstimates = updated;
          safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {
          console.warn('Failed to update local storage for category estimates', e);
        }
      }
      
      return updated;
    });
  };

  // Completion & Locking States
  const [isProjectLocked, setIsProjectLocked] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [onUnlockSuccessCallback, setOnUnlockSuccessCallback] = useState<(() => void) | null>(null);

  // Unified global UI settings handlers
  const handleGlobalFontSizeChange = (size: number) => {
    setFontSize(size);
    saveGlobalUIConfigToFirestore({ fontFamily, fontSize: size }).catch(console.warn);
  };

  const handleGlobalFontFamilyChange = (font: string) => {
    setFontFamily(font);
    saveGlobalUIConfigToFirestore({ fontFamily: font, fontSize }).catch(console.warn);
  };
  
  // Share Project State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoRuleCreation, setAutoRuleCreation] = useState<boolean>(() => {
    const saved = safeLocalStorage.getItem('mechauto_auto_rule_creation');
    return saved !== 'false'; // Default to true
  });

  // Persist auto rule creation setting
  useEffect(() => {
    safeLocalStorage.setItem('mechauto_auto_rule_creation', autoRuleCreation.toString());
  }, [autoRuleCreation]);

  // Session Recovery State
  const [pendingSession, setPendingSession] = useState<{ items: SpecItem[], theme: ThemeType, timestamp: number } | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  // 1. Setup real-time Firestore listeners & Cloud Hydration
  useEffect(() => {
    // Load local projects cache first and normalize existing items
    const savedProjects = safeLocalStorage.getItem(PROJECTS_KEY);
    if (savedProjects) {
      try {
        const parsed: Project[] = JSON.parse(savedProjects);
        let anyUpdated = false;
        const normalized = parsed.map(p => {
          if (p.items && p.items.length > 0) {
            const { items: newItems, updatedCount } = normalizeAllItemsSections(p.items);
            if (updatedCount > 0) {
              anyUpdated = true;
              return { ...p, items: newItems };
            }
          }
          return p;
        });
        setProjects(normalized);
        if (anyUpdated) {
          safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(normalized));
        }
      } catch (e) {
        console.error('Failed to parse projects', e);
      }
    }

    // Subscribe to Firestore Projects for real-time multi-PC synchronization
    const unsubscribeProjects = subscribeProjectsFromFirestore(firestoreProjects => {
      if (firestoreProjects && firestoreProjects.length >= 0) {
        let anyUpdated = false;
        const normalized = firestoreProjects.map(p => {
          if (p.items && p.items.length > 0) {
            const { items: newItems, updatedCount } = normalizeAllItemsSections(p.items);
            if (updatedCount > 0) {
              anyUpdated = true;
              return { ...p, items: newItems };
            }
          }
          return p;
        });
        setProjects(prev => {
          if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
          return normalized;
        });
        
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(normalized));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        
        setCloudSyncStatus('synced');
        setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
      }
    });

    // Subscribe to Firestore Custom Rules with intelligent non-destructive merging
    const unsubscribeRules = subscribeCustomRulesFromFirestore((firestoreRules, firestoreUpdatedAt) => {
      if (firestoreRules && Array.isArray(firestoreRules) && firestoreRules.length > 0) {
        setCustomClassificationRules(prev => {
          const merged = mergeClassificationRules(prev, firestoreRules);
          
          // If local had rules that Firestore didn't have yet, sync the merged set to Firestore
          if (merged.length > firestoreRules.length) {
            saveCustomRulesToFirestore(merged).catch(err => {
              console.warn('Failed to sync merged rules to Firestore:', err);
            });
          }

          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;

          safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(merged));
          safeLocalStorage.setItem('mechauto_custom_rules_updated_at', Date.now().toString());
          return merged;
        });
      } else {
        // If Firestore document doesn't exist yet or is empty, push current local rules to Firestore
        setCustomClassificationRules(prev => {
          if (prev && prev.length > 0) {
            saveCustomRulesToFirestore(prev).catch(err => {
              console.warn('Failed to initialize rules in Firestore:', err);
            });
          }
          return prev;
        });
      }
    });

    // Subscribe to Firestore Categories
    const unsubscribeCategories = subscribeCategoriesFromFirestore((firestoreCats, firestoreColors) => {
      if (firestoreCats && Array.isArray(firestoreCats) && firestoreCats.length > 0) {
        setCategories(prev => {
          // Merge to ensure locally created custom categories are preserved
          const merged = Array.from(new Set([...prev, ...firestoreCats]));
          if (merged.length > firestoreCats.length) {
            saveCategoriesToFirestore(merged).catch(console.warn);
          }
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          safeLocalStorage.setItem(CATEGORIES_KEY, JSON.stringify(merged));
          return merged;
        });
      }
      
      if (firestoreColors && Object.keys(firestoreColors).length > 0) {
        setCategoryColors(prev => {
          const merged = { ...prev, ...firestoreColors };
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          safeLocalStorage.setItem('mechauto_category_colors', JSON.stringify(merged));
          return merged;
        });
      }
    });

    // Subscribe to Global UI Config (Font settings)
    const unsubscribeUIConfig = subscribeGlobalUIConfigFromFirestore(config => {
      if (config.fontFamily) {
        setFontFamily(prev => prev === config.fontFamily ? prev : config.fontFamily);
      }
      if (config.fontSize) {
        setFontSize(prev => prev === config.fontSize ? prev : config.fontSize);
      }
    });

    // Subscribe to Learned Mappings (Classification Recommendation Service)
    const unsubscribeLearned = subscribeLearnedMappingsFromFirestore(mappings => {
      if (mappings && Object.keys(mappings).length > 0) {
        setLearnedMappings(prev => {
          const merged = { ...prev, ...mappings };
          safeLocalStorage.setItem('mechauto_learned_mappings', JSON.stringify(merged));
          return merged;
        });
      }
    });

    // Check Shared link or Firestore Active Session on Mount
    const checkSharedOrCloudSession = async () => {
      try {
        let shareDataStr = '';
        
        // Check query spec first
        const urlParams = new URLSearchParams(window.location.search);
        const queryShare = urlParams.get('share');
        if (queryShare) {
          shareDataStr = queryShare;
        } else {
          // Check hash
          const hash = window.location.hash;
          if (hash) {
            const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
            const hashParams = new URLSearchParams(cleanHash);
            const hashShare = hashParams.get('share');
            if (hashShare) {
              shareDataStr = hashShare;
            } else if (cleanHash.startsWith('share=')) {
              shareDataStr = cleanHash.substring(6);
            } else if (cleanHash.includes('share=')) {
              const idx = cleanHash.indexOf('share=');
              shareDataStr = cleanHash.substring(idx + 6);
            }
          }
        }

        if (shareDataStr) {
          try {
            shareDataStr = decodeURIComponent(shareDataStr).trim();
          } catch (e) {
            console.warn("Failed to decodeURIComponent shareDataStr", e);
          }

          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);

          showNotification('공유된 프로젝트 데이터를 불러오는 중...', 'info');
          
          const state = await decompressState(shareDataStr);
          if (state) {
            const restoredState = unminifyState(state);
            
            if (restoredState.items && restoredState.items.length > 0) {
              const healed = restoredState.items.map(healItem);
              const { items: normalized } = normalizeAllItemsSections(healed);
              setItems(normalized);
              if (restoredState.theme) setTheme(restoredState.theme);
              if (restoredState.categories) setCategories(restoredState.categories);
              if (restoredState.projectName) setCurrentProjectName(restoredState.projectName);
              
              setIsRecoveryModalOpen(false);
              setPendingSession(null);
              
              showNotification(`공유된 프로젝트 데이터를 성공적으로 불러왔습니다.`, 'success');
              return true;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load shared link', e);
        showNotification('공유 링크 데이터 해석 및 로드 중 오류가 발생했습니다.', 'error');
      }
      return false;
    };

    let unsubscribeActiveSession: (() => void) | null = null;

    const runInitCheck = async () => {
      const loadedShare = await checkSharedOrCloudSession();
      
      // If no explicit share link, subscribe to active cloud session
      if (!loadedShare) {
        unsubscribeActiveSession = subscribeActiveSessionFromFirestore(cloudSession => {
          if (cloudSession && cloudSession.items && cloudSession.items.length > 0) {
            // If local is currently empty or initial load, auto hydrate from cloud
            setItems(prevItems => {
              if (prevItems.length === 0) {
                if (cloudSession.theme) setTheme(cloudSession.theme);
                if (cloudSession.categories && cloudSession.categories.length > 0) {
                  setCategories(prev => JSON.stringify(prev) === JSON.stringify(cloudSession.categories) ? prev : cloudSession.categories);
                }
                if (cloudSession.projectName) setCurrentProjectName(cloudSession.projectName);
                if (cloudSession.categoryEstimates) setCategoryEstimates(cloudSession.categoryEstimates);
                setProjectMetadata({
                  commencementDate: cloudSession.commencementDate,
                  completionDate: cloudSession.completionDate,
                  buildingCount: cloudSession.buildingCount,
                  householdCount: cloudSession.householdCount,
                  highestFloor: cloudSession.highestFloor,
                  lowestFloor: cloudSession.lowestFloor,
                });
                setIsProjectLocked(!!cloudSession.isLocked);
                const healed = (cloudSession.items || []).map(healItem);
                return normalizeAllItemsSections(healed).items;
              }
              return prevItems;
            });
          } else {
            // Fallback to local session recovery if cloud is empty
            const saved = safeLocalStorage.getItem(STORAGE_KEY);
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed.items && parsed.items.length > 0) {
                  const healed = parsed.items.map(healItem);
                  const { items: normalized, updatedCount } = normalizeAllItemsSections(healed);
                  parsed.items = normalized;
                  if (updatedCount > 0) {
                    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                  }
                  setPendingSession(parsed);
                  setIsRecoveryModalOpen(true);
                }
              } catch (e) {
                console.error('Failed to parse saved session', e);
              }
            }
          }
        });
      }
    };

    const unsubscribeQuota = onQuotaStateChange(exceeded => {
      setIsQuotaExceededState(exceeded);
    });

    runInitCheck();

    return () => {
      unsubscribeProjects();
      unsubscribeRules();
      unsubscribeCategories();
      unsubscribeUIConfig();
      unsubscribeLearned();
      if (unsubscribeActiveSession) unsubscribeActiveSession();
      unsubscribeQuota();
    };
  }, []);

  // Immediately and automatically normalize active items hierarchically (공정분리된 내역 바로 반영)
  useEffect(() => {
    if (items.length > 0) {
      const { items: updatedItems, updatedCount } = normalizeAllItemsSections(items);
      if (updatedCount > 0) {
        setItems(updatedItems);
      }
    }
  }, [items]);

  // Update root styles for font
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  // Auto-save logic
  useEffect(() => {
    if (items.length > 0 && theme) {
      const sessionData = {
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        categoryEstimates,
        projectMetadata,
        timestamp: Date.now()
      };
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    }
  }, [items, theme, fontFamily, fontSize, categories, categoryEstimates, projectMetadata]);

  // Real-time site-specific auto-saving hook (Syncs to Local immediately and Debounced Firestore Cloud)
  useEffect(() => {
    if (isAutoSaveActive && items.length > 0 && theme) {
      setIsAutoSavingIndicator(true);

      const existingProj = currentProjectName ? projects.find(p => p.name === currentProjectName) : null;
      const existingId = existingProj?.id;
      const updatedProject: Project = {
        id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        name: currentProjectName || '작업 현장',
        items,
        theme,
        config: {
          theme,
          fontFamily,
          fontSize
        },
        categories,
        categoryEstimates,
        ...projectMetadata,
        separationMethod,
        updatedAt: Date.now(),
        status: existingProj?.status || (isProjectLocked ? 'completed' : 'working')
      };

      // 1. Immediate Local Storage Persistence (Zero lag, zero quota cost)
      if (currentProjectName) {
        setProjects(prev => {
          const updated = prev.some(p => p.name === currentProjectName)
            ? prev.map(p => p.name === currentProjectName ? updatedProject : p)
            : [...prev, updatedProject];
          
          const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
          if (!success) setIsLocalStorageQuotaExceeded(true);
          
          return updated;
        });
      }

      const now = new Date();
      setLastAutoSavedTime(now.toTimeString().split(' ')[0]);

      // 2. Debounced Cloud Sync (Waits 2.5s of inactivity to avoid hitting Firestore rate limits)
      const cloudSyncTimer = setTimeout(() => {
        if (isCloudQuotaExceeded()) {
          setCloudSyncStatus('synced');
          setIsAutoSavingIndicator(false);
          return;
        }

        setCloudSyncStatus('syncing');

        const promises: Promise<void>[] = [];

        if (currentProjectName) {
          promises.push(saveProjectToFirestore(updatedProject));
        }

        promises.push(
          saveActiveSessionToFirestore({
            projectName: currentProjectName,
            items,
            theme,
            fontFamily,
            fontSize,
            categories,
            categoryEstimates,
            ...projectMetadata,
            isLocked: isProjectLocked
          })
        );

        Promise.all(promises)
          .then(() => {
            setCloudSyncStatus('synced');
            setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
          })
          .catch(() => {
            setCloudSyncStatus('synced'); // graceful fallback
          })
          .finally(() => {
            setIsAutoSavingIndicator(false);
          });
      }, 2500);

      const indicatorTimer = setTimeout(() => {
        setIsAutoSavingIndicator(false);
      }, 800);

      return () => {
        clearTimeout(cloudSyncTimer);
        clearTimeout(indicatorTimer);
      };
    }
  }, [items, theme, fontFamily, fontSize, categories, categoryEstimates, projectMetadata, separationMethod, currentProjectName, isAutoSaveActive, isProjectLocked]);

  const handleManualSave = () => {
    if (!theme) {
      showNotification('테마를 먼저 선택해야 저장할 수 있습니다.', 'error');
      return;
    }
    if (items.length === 0) {
      showNotification('저장할 내역 데이터가 없습니다.', 'error');
      return;
    }

    if (currentProjectName) {
      handleSaveProject(currentProjectName);
      const now = new Date();
      setLastAutoSavedTime(now.toTimeString().split(' ')[0]);
      showNotification(`현장 [ ${currentProjectName} ] 정보가 클라우드 및 모든 기기에 저장되었습니다.`, 'success');
    } else {
      setManualSaveName('');
      setIsManualSaveNamingOpen(true);
    }
  };

  const handleConfirmManualSave = () => {
    if (!manualSaveName.trim()) {
      showNotification('현장명을 입력해야 저장이 가능합니다.', 'error');
      return;
    }
    handleSaveProject(manualSaveName.trim());
    const now = new Date();
    setLastAutoSavedTime(now.toTimeString().split(' ')[0]);
    setIsManualSaveNamingOpen(false);
  };

  const handleShareProject = async () => {
    if (items.length === 0) {
      showNotification('공유할 데이터가 없습니다. 먼저 내역을 가져오거나 파일을 로드해주세요.', 'error');
      return;
    }
    try {
      showNotification('공유 링크 생성 중...', 'info');
      const minState = minifyState(items, theme, categories, currentProjectName, fontFamily, fontSize);
      const encoded = await compressState(minState);
      
      const shareLink = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
      setShareUrl(shareLink);
      setIsShareModalOpen(true);
      setCopied(false);
    } catch (e) {
      console.error('Failed to generate share URL', e);
      showNotification('공유 링크 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      showNotification('공유 링크가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy', err);
      showNotification('링크 복사에 실패했습니다. 직접 복사해주세요.', 'error');
    });
  };

  const handleSaveProject = async (name: string) => {
    if (!theme) {
      showNotification('테마를 먼저 선택해야 저장할 수 있습니다.', 'error');
      return;
    }

    try {
      setCloudSyncStatus('syncing');
      const existingId = projects.find(p => p.name === name)?.id;
      const newProject: Project = {
        id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
        name,
        items,
        theme: theme,
        config: {
          theme: theme,
          fontFamily,
          fontSize
        },
        categories,
        updatedAt: Date.now(),
        status: projects.find(p => p.name === name)?.status || 'working',
        categoryEstimates,
        ...projectMetadata,
        separationMethod
      };

      setProjects(prev => {
        const updated = prev.some(p => p.name === name)
          ? prev.map(p => p.name === name ? newProject : p)
          : [...prev, newProject];
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        return updated;
      });

      setCurrentProjectName(name);

      // Persist to Cloud Firestore
      await saveProjectToFirestore(newProject);
      await saveActiveSessionToFirestore({
        projectName: name,
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        categoryEstimates,
        ...projectMetadata,
        isLocked: isProjectLocked
      });

      setCloudSyncStatus('synced');
      setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
      showNotification(`현장 '${name}' 정보가 클라우드 및 모든 기기에 성공적으로 저장되었습니다.`, 'success');
    } catch (e) {
      console.error('Failed to save project', e);
      setCloudSyncStatus('error');
      showNotification('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  };

  const handleLoadProject = (project: Project) => {
    try {
      const healed = (project.items || []).map(healItem);
      const { items: normalized } = normalizeAllItemsSections(healed);
      setItems(normalized);
      setTheme(project.theme);
      // We no longer override global font settings from per-project config to ensure "unified" experience
      /* 
      if (project.config) {
        setFontFamily(project.config.fontFamily || '"Gulim", "굴림", Dotum, "돋움", sans-serif');
        setFontSize(project.config.fontSize || 11);
      }
      */
      setCategories(prev => Array.from(new Set([...prev, ...(project.categories || INITIAL_CATEGORIES)])));
      setCurrentProjectName(project.name);
      setCategoryEstimates(project.categoryEstimates || {});
      setSeparationMethod(project.separationMethod || 'method2');
      setProjectMetadata({
        commencementDate: project.commencementDate,
        completionDate: project.completionDate,
        buildingCount: project.buildingCount,
        householdCount: project.householdCount,
        highestFloor: project.highestFloor,
        lowestFloor: project.lowestFloor,
      });
      
      // 세로(새로) 현장 선택 시 기본적으로 완료된 내역(completed) 상태 및 수정 락 활성화
      setIsProjectLocked(true);
      
      const updatedProject: Project = { 
        ...project, 
        status: 'completed' as const 
      };

      setProjects(prev => {
        const updated = prev.map(p => p.id === project.id ? updatedProject : p);
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        return updated;
      });

      // Synchronize active session & project status to Firestore
      saveProjectToFirestore(updatedProject).catch(console.warn);
      saveActiveSessionToFirestore({
        projectName: project.name,
        items: project.items || [],
        theme: project.theme,
        fontFamily,
        fontSize,
        categories: project.categories || INITIAL_CATEGORIES,
        categoryEstimates: project.categoryEstimates || {},
        commencementDate: project.commencementDate,
        completionDate: project.completionDate,
        buildingCount: project.buildingCount,
        householdCount: project.householdCount,
        highestFloor: project.highestFloor,
        lowestFloor: project.lowestFloor,
        isLocked: true
      }).catch(console.warn);

      showNotification(`현장 '${project.name}' 내역이 '내역분리 완료(수정 보호)' 상태로 로드되었습니다.`, 'success');
    } catch (e) {
      showNotification('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCompleteProject = async () => {
    if (!currentProjectName) {
      showNotification('내역분리 완료를 수행할 활성화된 현장이 없습니다.', 'error');
      return;
    }

    setIsProjectLocked(true);
    setSeparationMethod('method2'); // 공정분리방식 강제 적용

    const existingProj = projects.find(p => p.name === currentProjectName);
    let targetProject: Project;

    if (existingProj) {
      targetProject = {
        ...existingProj,
        status: 'completed',
        items,
        categoryEstimates,
        ...projectMetadata,
        separationMethod: 'method2',
        updatedAt: Date.now()
      };

      setProjects(prev => {
        const updated = prev.map(p => p.name === currentProjectName ? targetProject : p);
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        return updated;
      });
    } else {
      const newProjId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      targetProject = {
        id: newProjId,
        name: currentProjectName,
        items,
        theme: theme || 'industrial',
        config: { theme: theme || 'industrial', fontFamily, fontSize },
        categories,
        categoryEstimates,
        ...projectMetadata,
        separationMethod: 'method2',
        updatedAt: Date.now(),
        status: 'completed'
      };
      setProjects(prev => {
        const updated = [...prev, targetProject];
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        return updated;
      });
    }

    try {
      await saveProjectToFirestore(targetProject);
      await saveActiveSessionToFirestore({
        projectName: currentProjectName,
        items,
        theme,
        fontFamily,
        fontSize,
        categories,
        categoryEstimates,
        ...projectMetadata,
        isLocked: true
      });
      setCloudSyncStatus('synced');
      setLastCloudSyncedTime(new Date().toTimeString().split(' ')[0]);
    } catch (err) {
      console.warn('Failed to sync completed status to Firestore:', err);
    }

    showNotification(`현장 '${currentProjectName}' 내역분리가 '공정분리방식(B2)'으로 최종 완료되었습니다. (수정 시 비밀번호 필요)`, 'success');
  };

  const checkLockAndProceed = (action: () => void) => {
    if (isProjectLocked && currentProjectName) {
      setOnUnlockSuccessCallback(() => action);
      setIsPasswordModalOpen(true);
      setPasswordInput('');
      return false;
    }
    action();
    return true;
  };

  const handleVerifyPassword = () => {
    if (passwordInput === '4714') {
      setIsProjectLocked(false);
      setIsPasswordModalOpen(false);
      showNotification('비밀번호 인증 성공! 안심 수정 모드가 활성화되었습니다.', 'success');
      
      if (currentProjectName) {
        const existingProj = projects.find(p => p.name === currentProjectName);
        if (existingProj) {
          const updatedProj: Project = {
            ...existingProj,
            status: 'working',
            updatedAt: Date.now()
          };
          setProjects(prev => {
            const updated = prev.map(p => p.name === currentProjectName ? updatedProj : p);
            const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
            if (!success) setIsLocalStorageQuotaExceeded(true);
            return updated;
          });
          saveProjectToFirestore(updatedProj).catch(console.warn);
        }
      }

      if (onUnlockSuccessCallback) {
        onUnlockSuccessCallback();
        setOnUnlockSuccessCallback(null);
      }
    } else {
      showNotification('비밀번호가 일치하지 않습니다. 다시 입력해주세요.', 'error');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const projectToDelete = projects.find(p => p.id === id);
      if (!projectToDelete) return;

      setProjects(prev => {
        const updated = prev.filter(p => p.id !== id);
        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        return updated;
      });
      
      if (projectToDelete.name === currentProjectName) {
        setCurrentProjectName('');
      }

      await deleteProjectFromFirestore(id);

      showNotification(`현장 '${projectToDelete.name}' 프로젝트가 클라우드에서 삭제되었습니다.`, 'info');
    } catch (e) {
      console.error('Failed to delete project', e);
      showNotification('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleNewProject = () => {
    const hasData = items.length > 0;
    if (hasData) {
      const confirmNew = window.confirm('현재 작업 중인 데이터가 초기화됩니다. 정말로 새 현장 작업을 시작하시겠습니까?');
      if (!confirmNew) return;
    }
    
    setItems([]);
    setTheme(null);
    setWorkbook(null);
    setCurrentProjectName('');
    setCategoryEstimates({});
    setProjectMetadata({});
    setIsProjectLocked(false);
    showNotification('새로운 현장 작업 공간이 준비되었습니다.', 'info');
  };

  const handleAddNewProject = async (name: string) => {
    if (!name.trim()) return;

    // Auto-save existing project first if active to prevent data loss
    if (items.length > 0 && currentProjectName && theme) {
      try {
        const existingId = projects.find(p => p.name === currentProjectName)?.id;
        const currentData: Project = {
          id: existingId || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
          name: currentProjectName,
          items,
          theme,
          config: { theme, fontFamily, fontSize },
          categories,
          categoryEstimates,
          ...projectMetadata,
          separationMethod,
          updatedAt: Date.now(),
          status: projects.find(p => p.name === currentProjectName)?.status || 'working'
        };
        setProjects(prev => {
          const updated = prev.some(p => p.name === currentProjectName)
            ? prev.map(p => p.name === currentProjectName ? currentData : p)
            : [...prev, currentData];
          const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
          if (!success) setIsLocalStorageQuotaExceeded(true);
          return updated;
        });
        saveProjectToFirestore(currentData).catch(console.warn);
      } catch (e) {
        console.error('Failed to auto-save before new project swap', e);
      }
    }

    // Setup new empty project instance
    const newProjId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const currentActiveCategories = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
    const newProject: Project = {
      id: newProjId,
      name: name.trim(),
      items: [],
      theme: theme || 'industrial',
      config: {
        theme: theme || 'industrial',
        fontFamily,
        fontSize
      },
      categories: currentActiveCategories,
      updatedAt: Date.now(),
      status: 'working'
    };

    setProjects(prev => {
      const updated = [...prev, newProject];
      const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      if (!success) setIsLocalStorageQuotaExceeded(true);
      return updated;
    });

    setItems([]);
    setTheme(theme || 'industrial');
    setWorkbook(null);
    setCurrentProjectName(name.trim());
    setCategoryEstimates({});
    setProjectMetadata({});
    setSeparationMethod('method2');
    setIsProjectLocked(false);

    await saveProjectToFirestore(newProject);
    await saveActiveSessionToFirestore({
      projectName: name.trim(),
      items: [],
      theme: theme || 'industrial',
      fontFamily,
      fontSize,
      categories: currentActiveCategories,
      isLocked: false
    });

    showNotification(`새 현장 '${name.trim()}' 추가 및 클라우드 동기화가 완료되었습니다. 기계설비 엑셀 파일을 업로드해 주세요!`, 'success');
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        appName: 'mechauto_spec_analyzer',
        version: '1.0',
        backupDate: new Date().toISOString(),
        projects
      };
      
      const fileData = JSON.stringify(backupData, null, 2);
      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `기계설비_공정분석_백업_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('모든 현장 데이터 백업 파일(.json)이 다운로드되었습니다.', 'success');
    } catch (e) {
      console.error('Failed to export backup', e);
      showNotification('백업 파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleImportBackup = (importedData: any) => {
    try {
      let importedProjects: Project[] = [];
      
      if (importedData && Array.isArray(importedData)) {
        importedProjects = importedData;
      } else if (importedData && Array.isArray(importedData.projects)) {
        importedProjects = importedData.projects;
      } else {
        showNotification('유효한 백업 데이터 형식이 아닙니다.', 'error');
        return;
      }

      if (importedProjects.length === 0) {
        showNotification('백업될 현장 데이터가 비어 있습니다.', 'info');
        return;
      }

      setProjects(prev => {
        const updated = [...prev];
        let overwriteCount = 0;
        let newCount = 0;

        importedProjects.forEach(ip => {
          if (!ip.name || !Array.isArray(ip.items)) return;

          const matchIdx = updated.findIndex(p => p.name.trim() === ip.name.trim());
          if (matchIdx !== -1) {
            updated[matchIdx] = {
              ...updated[matchIdx],
              ...ip,
              id: updated[matchIdx].id || ip.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
              updatedAt: ip.updatedAt || Date.now()
            };
            overwriteCount++;
          } else {
            updated.push({
              ...ip,
              id: ip.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
              updatedAt: ip.updatedAt || Date.now()
            });
            newCount++;
          }
        });

        const success = safeLocalStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        if (!success) setIsLocalStorageQuotaExceeded(true);
        
        let msg = `성공적으로 데이터를 복원하였습니다.`;
        if (newCount > 0) msg += ` (신규 ${newCount}개 추가)`;
        if (overwriteCount > 0) msg += ` (기존 ${overwriteCount}개 갱신)`;
        
        showNotification(msg, 'success');
        return updated;
      });
    } catch (e) {
      console.error('Import backup failed', e);
      showNotification('백업 데이터를 복원하는 중에 실패했습니다. 파일 형식을 확인해주세요.', 'error');
    }
  };

  const restoreSession = () => {
    if (pendingSession) {
      const healed = ((pendingSession as any).items || []).map(healItem);
      const { items: normalized } = normalizeAllItemsSections(healed);
      setItems(normalized);
      setTheme((pendingSession as any).theme);
      if ((pendingSession as any).fontFamily) setFontFamily((pendingSession as any).fontFamily);
      if ((pendingSession as any).fontSize) setFontSize((pendingSession as any).fontSize);
      if ((pendingSession as any).categories && Array.isArray((pendingSession as any).categories) && (pendingSession as any).categories.length > 0) {
        setCategories((pendingSession as any).categories);
      }
      if ((pendingSession as any).categoryEstimates) {
        setCategoryEstimates((pendingSession as any).categoryEstimates);
      }
      if ((pendingSession as any).projectMetadata) {
        setProjectMetadata((pendingSession as any).projectMetadata);
      }
      setIsProjectLocked(false);
      setIsRecoveryModalOpen(false);
      setPendingSession(null);
      showNotification('이전 작업 세션이 복구되었습니다.', 'success');
    }
  };

  const discardSession = () => {
    safeLocalStorage.removeItem(STORAGE_KEY);
    setIsRecoveryModalOpen(false);
    setPendingSession(null);
  };

  useEffect(() => {
    if (isLocalStorageQuotaExceeded) {
      showNotification('브라우저 저장 용량이 초과되었습니다. 최신 데이터는 클라우드(Firestore)에 안전하게 저장되지만, 로컬 캐시 저장은 제한됩니다.', 'error');
    }
  }, [isLocalStorageQuotaExceeded]);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // targetIds 가 주어지면 선택된(또는 미분류) 품목만 분류하고, 나머지 품목의 분류는 그대로 둔다
  const handleClassify = async (targetIds?: string[]) => {
    checkLockAndProceed(async () => {
      const targetIdSet = targetIds && targetIds.length > 0 ? new Set(targetIds) : null;
      const targetItems = targetIdSet ? items.filter(it => targetIdSet.has(it.id)) : items;
      const sectionInfoForClassify = buildSectionDisplayInfo(items);
      if (targetItems.length === 0) {
        showNotification('분류할 품목이 없습니다.', 'info');
        return;
      }
      setIsClassifying(true);
      setClassifyProgress(0);
      try {
        const BATCH_SIZE = 50;
        const allClassifications: any[] = [];
        const totalItems = targetItems.length;
        
        for (let i = 0; i < totalItems; i += BATCH_SIZE) {
          const batch = targetItems.slice(i, i + BATCH_SIZE);
          
          // Brief throttle between batches
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 400));
          }
          
          // Client-side retry logic for each batch
          let batchSuccess = false;
          let batchRetries = 2;
          let lastBatchError = '';
          
          while (batchRetries >= 0 && !batchSuccess) {
            try {
              const response = await fetch('/api/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  items: batch.map(bi => ({ 
                    id: bi.id, 
                    name: bi.name, 
                    specification: bi.specification,
                    section: bi.section,
                    sectionParent: bi.sectionParent ?? sectionInfoForClassify.get(bi.id)?.parents.join(' › ') ?? '',
                    materialUnitPrice: bi.materialUnitPrice,
                    laborUnitPrice: bi.laborUnitPrice,
                    remark: bi.remark
                  })),
                  categories,
                  customRules: customClassificationRules
                })
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  errorData = { error: `Server error (${response.status}): ${errorText.substring(0, 100)}...` };
                }
                throw new Error(errorData.message || errorData.error || `Server responded with ${response.status}`);
              }
              
              const text = await response.text();
              let classifications;
              try {
                classifications = JSON.parse(text);
                batchSuccess = true;
                allClassifications.push(...classifications);
              } catch (e) {
                throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}...`);
              }
            } catch (err: any) {
              lastBatchError = err.message || String(err);
              if (batchRetries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              batchRetries--;
            }
          }

          if (!batchSuccess) {
            // Even if network failed, apply client-side heuristic classification for this batch
            batch.forEach(item => {
              allClassifications.push({
                id: item.id,
                category: item.remark && categories.includes(item.remark) 
                  ? item.remark 
                  : '미분류'
              });
            });
          }
          
          setClassifyProgress(Math.min(Math.round(((i + batch.length) / totalItems) * 100), 100));
        }
        
        const classificationById = new Map<string, any>(allClassifications.map((c: any) => [c.id, c]));
        const newItems = items.map(item => {
          const found = classificationById.get(item.id);
          // Also update remark field with category name as requested by user
          return found ? { ...item, category: found.category, remark: found.category } : item;
        });
        
        setItems(newItems);
        showNotification(`총 ${targetItems.length}개의 항목이 분류되었습니다.`, 'success');
      } catch (error: any) {
        console.error('Classification failed:', error);
        showNotification(error.message || '분류 중 오류가 발생했습니다.', 'error');
      } finally {
        setIsClassifying(false);
        setTimeout(() => setClassifyProgress(0), 500);
      }
    });
  };

  const handleAddCategory = (newCategory: string) => {
    if (newCategory && !categories.includes(newCategory)) {
      handleUpdateCategoryList([...categories, newCategory]);
      showNotification(`신규 카테고리 [${newCategory}]가 추가되었습니다.`, 'success');
    }
  };

  const handleUpdateCategory = (id: string, newCategory: string) => {
    checkLockAndProceed(() => {
      const item = items.find(i => i.id === id);
      if (!item) return;

      const oldCategory = item.category;

      // Auto-add category if it's not in the list
      if (newCategory && !categories.includes(newCategory)) {
        handleAddCategory(newCategory);
      }

      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, category: newCategory, remark: newCategory, recommendationSource: 'manual' as const } : item
      ));

      // 1. Classification Recommendation Service: Record this mapping
      if (item.name && newCategory && newCategory !== oldCategory) {
        saveLearnedMappingToFirestore({
          name: item.name.trim(),
          specification: (item.specification || '').trim(),
          category: newCategory
        }).catch(err => console.warn('Failed to save learned mapping:', err));
      }

      // 2. Track pattern performance (failure/correction feedback on matching patterns)
      if (item.name && newCategory && newCategory !== oldCategory) {
        setCustomClassificationRules(prevRules => {
          const { updatedRules, changed } = recordRuleExecutionFeedback(prevRules, [{
            name: item.name,
            specification: item.specification,
            finalCategory: newCategory,
            isCorrectiveOverride: true
          }]);
          if (changed) {
            safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(updatedRules));
            saveCustomRulesToFirestore(updatedRules).catch(() => {});
            return updatedRules;
          }
          return prevRules;
        });
      }

      // 3. Handle automatic rule creation/update if enabled
      if (autoRuleCreation && item.name && newCategory && newCategory !== oldCategory) {
        const cleanName = item.name.trim();
        if (cleanName) {
          updateRuleFromClassification(cleanName, newCategory);
        }
      }
    });
  };

  const updateRuleFromClassification = (name: string, category: string) => {
    updateRulesFromClassifications([{ name, category }]);
  };

  const updateRulesFromClassifications = (entries: { name: string; category: string }[]) => {
    if (!entries || entries.length === 0) return;

    setCustomClassificationRules(prevRules => {
      let updatedRules = [...prevRules];
      let createdCount = 0;
      let updatedCount = 0;

      entries.forEach(({ name, category }) => {
        const cleanName = (name || '').trim();
        const cleanCat = (category || '').trim();
        if (!cleanName || !cleanCat) return;

        const normKey = cleanName.toLowerCase().replace(/\s+/g, '');
        const existingIdx = updatedRules.findIndex(
          r => (r.pattern || '').toLowerCase().replace(/\s+/g, '') === normKey
        );

        if (existingIdx !== -1) {
          if (updatedRules[existingIdx].category !== cleanCat) {
            updatedRules[existingIdx] = {
              ...updatedRules[existingIdx],
              category: cleanCat,
              isEnabled: true,
              failureCount: (updatedRules[existingIdx].failureCount || 0) + 1,
              lastEvaluatedAt: Date.now()
            };
            updatedCount++;
          }
        } else {
          const newRule: CustomClassificationRule = {
            id: `auto-rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            pattern: cleanName,
            category: cleanCat,
            isEnabled: true,
            priority: 50, // Higher than default 10 to ensure manual overrides stick
            description: `지능형 자동 학습 (${new Date().toLocaleDateString()})`,
            successCount: 1,
            failureCount: 0,
            lastEvaluatedAt: Date.now()
          };
          updatedRules.push(newRule);
          createdCount++;
        }
      });

      if (createdCount === 0 && updatedCount === 0) {
        return prevRules;
      }

      // Synchronous local persistence immediately
      safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(updatedRules));
      safeLocalStorage.setItem('mechauto_custom_rules_updated_at', Date.now().toString());

      // Cloud Firestore synchronization
      saveCustomRulesToFirestore(updatedRules).catch(err => {
        console.warn('Failed to sync rules to Firestore:', err);
      });

      if (entries.length === 1) {
        if (createdCount > 0) {
          showNotification(`신규 규칙 자동저장: '${entries[0].name}' → '${entries[0].category}' 분류 규칙이 영구 저장되었습니다.`, 'success');
        } else if (updatedCount > 0) {
          showNotification(`품명 '${entries[0].name}'에 대한 분류 규칙이 '${entries[0].category}'(으)로 갱신 및 저장되었습니다.`, 'info');
        }
      } else if (createdCount > 0 || updatedCount > 0) {
        showNotification(`지능형 자동 학습: ${createdCount + updatedCount}개 품목의 분류 규칙이 영구 저장되었습니다.`, 'success');
      }

      return updatedRules;
    });
  };

  const handleRevertCategory = (id: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id && item.originalCategory 
          ? { ...item, category: item.originalCategory, remark: item.originalCategory } 
          : item
      ));
      showNotification('품목 분류가 원래 상태로 복구되었습니다.', 'info');
    });
  };

  const handleUpdateCategories = (ids: string[], newCategory: string) => {
    checkLockAndProceed(() => {
      const targetItems = items.filter(i => ids.includes(i.id));
      if (targetItems.length === 0) return;

      // Auto-add category if it's not in the list
      if (newCategory && !categories.includes(newCategory)) {
        handleAddCategory(newCategory);
      }
      setItems(prev => prev.map(item => 
        ids.includes(item.id) ? { ...item, category: newCategory, remark: newCategory, recommendationSource: 'manual' as const } : item
      ));

      // 1. Classification Recommendation Service: Record mappings for all unique name+spec combos
      if (newCategory) {
        const uniqueCombos = new Map<string, {name: string, spec: string}>();
        targetItems.forEach(item => {
          if (item.name) {
            const key = `${item.name.trim()}_${(item.specification || '').trim()}`;
            if (!uniqueCombos.has(key)) {
              uniqueCombos.set(key, { name: item.name.trim(), spec: (item.specification || '').trim() });
            }
          }
        });

        uniqueCombos.forEach(combo => {
          saveLearnedMappingToFirestore({
            name: combo.name,
            specification: combo.spec,
            category: newCategory
          }).catch(err => console.warn('Failed to save learned mapping (bulk):', err));
        });
      }

      // 2. Track pattern performance (failure/correction feedback on matching patterns)
      if (newCategory) {
        setCustomClassificationRules(prevRules => {
          const feedbackEntries = targetItems.map(ti => ({
            name: ti.name,
            specification: ti.specification,
            finalCategory: newCategory,
            isCorrectiveOverride: ti.category !== newCategory
          }));
          const { updatedRules, changed } = recordRuleExecutionFeedback(prevRules, feedbackEntries);
          if (changed) {
            safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(updatedRules));
            saveCustomRulesToFirestore(updatedRules).catch(() => {});
            return updatedRules;
          }
          return prevRules;
        });
      }

      // 3. Handle automatic rule creation for multiple items (atomic batch update)
      if (autoRuleCreation && newCategory) {
        const uniqueNames = Array.from(new Set(targetItems.map(i => (i.name || '').trim()).filter(Boolean))) as string[];
        if (uniqueNames.length > 0) {
          const entries = uniqueNames.map(name => ({ name, category: newCategory }));
          updateRulesFromClassifications(entries);
        }
      }

      showNotification(`${ids.length}개 항목의 카테고리가 '${newCategory}'(으)로 변경되었습니다.`, 'success');
    });
  };

  const handleUpdateSections = (ids: string[], newSection: string) => {
    checkLockAndProceed(() => {
      const formatted = formatSectionWithHierarchy(newSection);
      setItems(prev => prev.map(item => 
        ids.includes(item.id) ? { ...item, section: formatted } : item
      ));
      showNotification(`${ids.length}개 항목의 구간 정보가 '${formatted}'(으)로 수정되었습니다.`, 'success');
    });
  };

  const handleOrganizeSectionHierarchy = () => {
    checkLockAndProceed(() => {
      const { items: updatedItems, updatedCount } = normalizeAllItemsSections(items);
      if (updatedCount > 0) {
        setItems(updatedItems);
        showNotification(`${updatedCount}개 항목의 공종 계층명(세대내 난방 배관공사 등)이 표준 형식으로 정리되었습니다.`, 'success');
      } else {
        showNotification('모든 공종 계층명이 이미 표준 형식으로 정리되어 있습니다.', 'info');
      }
    });
  };

  const handleRenameCategory = (oldCategory: string, newCategory: string) => {
    const trimmedOld = oldCategory.trim();
    const trimmedNew = newCategory.trim();
    if (!trimmedNew || trimmedOld === trimmedNew) return;

    checkLockAndProceed(() => {
      // 1. Update all items currently assigned to the old category
      let affectedCount = 0;
      setItems(prevItems => {
        return prevItems.map(item => {
          if (item.category === trimmedOld) {
            affectedCount++;
            return {
              ...item,
              category: trimmedNew,
              remark: item.remark === trimmedOld ? trimmedNew : item.remark
            };
          }
          return item;
        });
      });

      // 2. Update category list state & Firestore
      setCategories(prevCategories => {
        let updated: string[];
        if (prevCategories.includes(trimmedOld)) {
          updated = prevCategories.map(c => (c === trimmedOld ? trimmedNew : c));
        } else {
          updated = [...prevCategories, trimmedNew];
        }
        const unique = Array.from(new Set(updated));
        safeLocalStorage.setItem(CATEGORIES_KEY, JSON.stringify(unique));
        saveCategoriesToFirestore(unique).catch(err => {
          console.warn('Failed to sync categories to Firestore:', err);
        });
        return unique;
      });

      // 3. Update category color mappings
      setCategoryColors(prevColors => {
        if (prevColors[trimmedOld]) {
          const updated = { ...prevColors, [trimmedNew]: prevColors[trimmedOld] };
          delete updated[trimmedOld];
          safeLocalStorage.setItem('mechauto_category_colors', JSON.stringify(updated));
          saveCategoryColorsToFirestore(updated).catch(err => {
            console.warn('Failed to sync category colors to Firestore:', err);
          });
          return updated;
        }
        return prevColors;
      });

      // 4. Update manual category estimates
      setCategoryEstimates(prevEstimates => {
        if (prevEstimates[trimmedOld] !== undefined) {
          const updated = { ...prevEstimates, [trimmedNew]: prevEstimates[trimmedOld] };
          delete updated[trimmedOld];
          return updated;
        }
        return prevEstimates;
      });

      // 5. Update custom classification rules matching the old category
      setCustomClassificationRules(prevRules => {
        const hasMatchingRule = prevRules.some(r => r.category === trimmedOld);
        if (hasMatchingRule) {
          const updated = prevRules.map(r => (r.category === trimmedOld ? { ...r, category: trimmedNew } : r));
          safeLocalStorage.setItem('mechauto_custom_rules', JSON.stringify(updated));
          saveCustomRulesToFirestore(updated).catch(err => {
            console.warn('Failed to sync rules to Firestore:', err);
          });
          return updated;
        }
        return prevRules;
      });

      // 6. Update learned mappings
      setLearnedMappings(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === trimmedOld) {
            next[k] = trimmedNew;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // 7. Update active category filter if currently focused on the old category
      setCategoryFilter(prev => (prev === trimmedOld ? trimmedNew : prev));

      showNotification(
        `카테고리명이 [${trimmedOld}]에서 [${trimmedNew}](으)로 변경되었습니다. (${affectedCount}개 품목 반영)`,
        'success'
      );
    });
  };

  const handleUpdateMemo = (id: string, newMemo: string) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, memo: newMemo } : item
      ));
    });
  };

  const handleUpdateExecutionAmount = (id: string, amount: number) => {
    checkLockAndProceed(() => {
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, executionAmount: amount } : item
      ));
    });
  };

  const handleUpdateSafetyAmount = (amount: number) => {
    checkLockAndProceed(() => {
      setItems(prev => {
        const idx = prev.findIndex(item => item.id === 'manual-safety-item');
        if (idx !== -1) {
          if (amount <= 0) {
            return prev.filter(item => item.id !== 'manual-safety-item');
          }
          return prev.map(item => 
            item.id === 'manual-safety-item' 
              ? { 
                  ...item, 
                  materialUnitPrice: amount,
                  materialAmount: amount, 
                  unitPrice: amount, 
                  amount: amount 
                } 
              : item
          );
        } else if (amount > 0) {
          const newItem: SpecItem = {
            id: 'manual-safety-item',
            name: '안전장비류 (수동 입력)',
            specification: '현장안전용품',
            unit: '식',
            quantity: 1,
            materialUnitPrice: amount,
            materialAmount: amount,
            laborUnitPrice: 0,
            laborAmount: 0,
            unitPrice: amount,
            amount: amount,
            category: '안전장비류',
            section: '가설 및 안전공사',
            remark: '수동 입력'
          };
          return [...prev, newItem];
        }
        return prev;
      });
      showNotification('안전장비류 수동 입력 금액이 반영되었습니다.', 'success');
    });
  };

  const handleDataLoaded = (newItems: SpecItem[], wb: XLSX.WorkBook) => {
    // Apply automatic classification based on rules immediately upon upload, and heal quantities
    const classifiedItems = newItems.map(rawItem => {
      const item = healItem(rawItem);
      // 1. Check History-based Learned Mappings First (Highest confidence)
      const learnedKey = `${(item.name || '').trim()}_${(item.specification || '').trim()}`;
      const learnedCategory = learnedMappings[learnedKey];
      
      if (learnedCategory) {
        return {
          ...item,
          category: learnedCategory,
          originalCategory: learnedCategory,
          remark: learnedCategory,
          recommendationSource: 'history' as const
        };
      }

      // 2. Fallback to Rule-based Classification
      const { category, remark } = autoClassify(item, customClassificationRules);
      const finalCategory = category || item.category;
      return { 
        ...item, 
        category: finalCategory,
        originalCategory: finalCategory, // Store initial rule-based classification
        remark: remark || item.remark,
        recommendationSource: category ? 'rule' as const : 'ai' as const
      };
    });
    
    const { items: normalizedClassified } = normalizeAllItemsSections(classifiedItems);
    setItems(normalizedClassified);
    setWorkbook(wb);
    showNotification(`엑셀 파일 업로드 완료: ${normalizedClassified.length}개의 항목을 불러왔으며, 공종 계층 표준화 및 규칙 기반 자동 분류가 적용되었습니다.`, 'success');
  };

  const handleDownloadResults = async () => {
    if (items.length === 0) {
      showNotification('다운로드할 데이터가 없습니다.', 'error');
      return;
    }

    try {
      showNotification('고급 서식 엑셀 파일 생성 중...', 'info');
      await exportStyledExcel({
        projectName: currentProjectName || '기계설비_공정분리',
        items,
        categories
      });
      showNotification('카테고리_구간별_집계표 및 카테고리별 개별 시트(백강관, STS 등)가 포함된 고급 엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (e: any) {
      console.error('Export failed', e);
      showNotification(e.message || '파일 생성 중 오류가 발생했습니다.', 'error');
    }
  };

  const renderHeader = () => {
    if (theme === 'high-density') {
      return (
        <header className="flex items-center justify-between px-6 py-3 bg-[#141414] text-white">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center font-bold text-lg rounded-sm">M</div>
            <h1 className="text-sm font-semibold tracking-widest uppercase truncate max-w-[200px]">기계설비 공정분리 툴 v4.0</h1>
            
            <div className="h-6 w-px bg-white/20 mx-1" />
            
            <ProjectSiteManager 
              projects={projects}
              currentProjectName={currentProjectName}
              theme={theme}
              onSave={handleSaveProject}
              onLoad={handleLoadProject}
              onDelete={handleDeleteProject}
              onNew={handleNewProject}
              onAddNewProject={handleAddNewProject}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />

            {/* 실시간 자동 저장 스위치 및 상태 지시등 (High Density) */}
            <div className="flex items-center gap-3 bg-white/5 px-2.5 py-1 rounded border border-white/10" id="hd-autosave-panel">
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isAutoSaveActive;
                    setIsAutoSaveActive(nextVal);
                    showNotification(nextVal ? '실시간 자동 저장이 활성화되었습니다.' : '실시간 자동 저장이 비활성화되었습니다.', 'info');
                  }}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-white/20 transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoSaveActive ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                  title="실시간 자동 저장 켜기/끄기"
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-[1px] ${
                      isAutoSaveActive ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-[10px] text-zinc-300 font-mono select-none">자동 저장</span>
              </div>
              {currentProjectName && (
                <div className="hidden sm:flex items-center gap-1 text-[9px] text-emerald-400 font-mono pl-1.5 border-l border-white/10">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoSaveActive && isAutoSavingIndicator ? 'bg-amber-400 animate-pulse' : (isAutoSaveActive ? 'bg-emerald-400' : 'bg-zinc-500')}`} />
                  <span>{isAutoSaveActive ? (lastAutoSavedTime ? `완료 (${lastAutoSavedTime})` : '활성화됨') : '꺼짐'}</span>
                </div>
              )}
            </div>

            {/* 내역분리 완료 제어부 (High Density) */}
            {currentProjectName && (
              <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded border border-white/10" id="hd-completion-panel">
                {isProjectLocked ? (
                  <>
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 font-mono">
                      🔒 내역분리 완료
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOnUnlockSuccessCallback(null);
                        setIsPasswordModalOpen(true);
                        setPasswordInput('');
                      }}
                      className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-[9px] font-bold rounded text-white transition-colors cursor-pointer"
                      title="비밀번호(4714)를 입력하여 수정을 허용합니다"
                    >
                      잠금해제
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 font-mono">
                      🔓 수정중
                    </span>
                    <button
                      type="button"
                      onClick={handleCompleteProject}
                      className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-[9px] font-bold rounded text-white transition-colors cursor-pointer"
                      title="내역분리를 완료하고 데이터를 보호합니다"
                    >
                      완료처리
                    </button>
                  </>
                )}
              </div>
            )}
            {isQuotaExceededState ? (
              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-[9px] font-mono border border-amber-500/40 cursor-pointer text-amber-300 transition-colors"
                title="Firestore 무료 일일 할당량 도달 - 안전한 로컬 저장소 모드 가동 중 (클릭하여 안내 보기)"
              >
                <Cloud size={11} className="text-amber-400" />
                <span className="text-amber-200/90">저장소:</span>
                <span className="text-amber-300 font-bold">로컬 모드 (Cloud 한도)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[9px] font-mono border border-white/15" title="모든 PC 및 기기와 실시간 클라우드 동기화 중">
                <Cloud size={11} className={cloudSyncStatus === 'syncing' ? 'text-amber-400 animate-spin' : 'text-sky-400'} />
                <span className="text-white/80">클라우드:</span>
                <span className="text-emerald-400 font-bold">
                  {cloudSyncStatus === 'syncing' ? '동기화 중...' : (lastCloudSyncedTime ? `동기화됨 (${lastCloudSyncedTime})` : '연결됨')}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-[11px] opacity-60 font-mono hidden md:block">가동 상태: 정상</div>
            <div className="flex gap-2 items-center">
              {items.length > 0 && (
                <>
                  <button 
                    onClick={handleManualSave}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold uppercase rounded border border-emerald-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="현재 수동 저장"
                  >
                    <Save size={12} />
                    수동 저장
                  </button>
                  <button 
                    onClick={handleShareProject}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-[10px] font-bold uppercase rounded border border-amber-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 size={12} />
                    공유하기
                  </button>
                  <button 
                    onClick={handleDownloadResults}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-[10px] font-bold uppercase rounded border border-blue-400 text-white transition-colors flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    결과 다운로드
                  </button>
                </>
              )}
              <button 
                onClick={() => setItems([])}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-bold uppercase rounded border border-white/20 transition-colors"
              >
                데이터 초기화
              </button>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] uppercase font-bold text-green-400">AI 프로세서 활성화</span>
            </div>
          </div>
        </header>
      );
    }

    return (
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-6 lg:p-10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mb-1">
            <span>데이터 관리</span>
            <ChevronRight size={14} />
            <span className="text-indigo-500 font-medium font-mono uppercase tracking-wider">{theme || '신규'} 테마</span>
            <ChevronRight size={14} />
            <div className="ml-2 flex flex-wrap items-center gap-2">
              <ProjectSiteManager 
                projects={projects}
                currentProjectName={currentProjectName}
                theme={theme}
                onSave={handleSaveProject}
                onLoad={handleLoadProject}
                onDelete={handleDeleteProject}
                onNew={handleNewProject}
                onAddNewProject={handleAddNewProject}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
              />
              {/* 클라우드 동기화 상태 뱃지 (Standard) */}
              {isQuotaExceededState ? (
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(true)}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/90 px-3 py-1 rounded-full shadow-sm select-none border border-amber-300/80 transition-all font-sans text-xs cursor-pointer"
                  id="standard-cloud-sync-panel"
                  title="Firestore 무료 일일 할당량 도달 - 안전한 로컬 저장소 모드 가동 중 (클릭하여 상세 정보 확인)"
                >
                  <Cloud size={14} className="text-amber-600" />
                  <span className="font-bold text-amber-900">로컬 안전모드</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[11px] font-mono text-amber-700">Cloud 한도 (로컬 보존)</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans text-xs" id="standard-cloud-sync-panel" title="다른 PC나 브라우저에서 열어도 작업 내역이 동일하게 유지됩니다">
                  <Cloud size={14} className={cloudSyncStatus === 'syncing' ? 'text-amber-500 animate-spin' : 'text-indigo-600'} />
                  <span className="font-bold text-slate-700">클라우드</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${cloudSyncStatus === 'syncing' ? 'bg-amber-400 animate-ping' : (cloudSyncStatus === 'error' ? 'bg-rose-500' : 'bg-emerald-500')}`} />
                  <span className="text-[11px] font-mono text-slate-500">
                    {cloudSyncStatus === 'syncing' ? '동기화중' : (lastCloudSyncedTime ? `동기화됨 (${lastCloudSyncedTime})` : '실시간 연결')}
                  </span>
                </div>
              )}
              {/* 실시간 자동 저장 스위치 및 상태 지시등 (Standard) */}
              <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans" id="standard-autosave-panel">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isAutoSaveActive;
                    setIsAutoSaveActive(nextVal);
                    showNotification(nextVal ? '실시간 자동 저장이 활성화되었습니다.' : '실시간 자동 저장이 비활성화되었습니다.', 'info');
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutoSaveActive ? 'bg-indigo-600 animate-none' : 'bg-slate-300'
                  }`}
                  title="실시간 자동 저장 켜기/끄기"
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-[2px] ${
                      isAutoSaveActive ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-600">실시간 자동 저장</span>
                {currentProjectName && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoSaveActive && isAutoSavingIndicator ? 'bg-amber-500 animate-ping' : (isAutoSaveActive ? 'bg-emerald-500' : 'bg-slate-400')}`} />
                )}
                {currentProjectName && (
                  <span className="text-[11px] font-medium font-mono text-slate-500">
                    {isAutoSaveActive ? (lastAutoSavedTime ? `완료 (${lastAutoSavedTime})` : '활성화됨') : '비활성'}
                  </span>
                )}
              </div>

              {/* 내역분리 완료 제어부 (Standard) */}
              {currentProjectName && (
                <div className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/85 px-3 py-1 rounded-full shadow-sm select-none border border-slate-200/50 transition-all font-sans" id="standard-completion-panel">
                  {isProjectLocked ? (
                    <>
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1 font-sans">
                        🔒 내역분리 완료
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOnUnlockSuccessCallback(null);
                          setIsPasswordModalOpen(true);
                          setPasswordInput('');
                        }}
                        className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-[10px] font-bold rounded-full text-white transition-all shadow-sm cursor-pointer"
                        title="비밀번호(4714)를 입력하여 수정을 허용합니다"
                      >
                        수정하기 (암호)
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 font-sans">
                        🔓 작업중
                      </span>
                      <button
                        type="button"
                        onClick={handleCompleteProject}
                        className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold rounded-full text-white transition-all shadow-sm cursor-pointer"
                        title="기계설비 공정 분류 및 내역 조율을 마감하고 완료 처리합니다"
                      >
                        내역분리 완료
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">기계설비 공정 분석 마스터</h1>
        </div>
        
        {theme && (
          <div className="flex items-center gap-3">
             {items.length > 0 && (
               <>
                 <button 
                   onClick={handleManualSave}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-100 text-sm font-bold cursor-pointer"
                   title="현장 수동 저장"
                 >
                   <Save size={16} />
                   <span>수동 저장</span>
                 </button>
                 <button 
                   onClick={handleShareProject}
                   className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-lg shadow-amber-200 text-sm font-bold cursor-pointer"
                 >
                   <Share2 size={16} />
                   <span>공유하기</span>
                 </button>
                 <button 
                   onClick={handleDownloadResults}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm font-bold"
                 >
                   <Download size={16} />
                   <span>결과 다운로드</span>
                 </button>
               </>
             )}
             <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/${i + 10}/32/32`} 
                    className="w-8 h-8 rounded-full border-2 border-white"
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
             </div>
             <div className="text-xs text-slate-400 font-medium ml-2 text-right">
                박주민 님 외 2인이<br/>함께 검토 중입니다
             </div>
          </div>
        )}
      </header>
    );
  };

  if (!theme) {
    return (
      <div className="min-h-screen bg-slate-50">
        {renderHeader()}
        <TemplateSelector onSelect={setTheme} />
        {notification && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
             <span className={`px-6 py-2 rounded-full text-white text-sm font-bold shadow-xl ${notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
                {notification.message}
             </span>
          </div>
        )}
      </div>
    );
  }

  const themeClasses = {
    industrial: 'bg-slate-950 text-slate-100',
    modern: 'bg-slate-50 text-slate-900',
    minimal: 'bg-zinc-50 text-zinc-900',
    'high-density': 'bg-[#F4F4F2] text-[#141414] font-sans'
  }[theme];

  return (
    <div className={`min-h-screen ${themeClasses} transition-colors duration-500 relative`}>
      {/* Password Verification Dialog Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl border-2 ${
                theme === 'high-density' ? 'bg-[#E7E6E1] border-[#141414] rounded-none' : 'bg-white border-slate-100 rounded-2xl'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${
                theme === 'high-density' ? 'bg-[#141414] text-white border-b-2 border-black' : 'bg-indigo-50 border-b border-indigo-100 text-indigo-900'
              }`}>
                <div className="flex items-center gap-2">
                  <Lock size={16} className={theme === 'high-density' ? 'text-yellow-400' : 'text-indigo-600'} />
                  <h3 className="text-xs font-black uppercase tracking-widest">수정 권한 확인</h3>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    theme === 'high-density' ? 'bg-black text-yellow-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <KeySquare size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">여기는 '내역분리 완료' 보호구역입니다.</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    공정이 완료 마감처리된 현장입니다. 수동 수정을 허용하고 편집하시려면 관리자 비밀번호를 입력하십시오.
                  </p>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">관리자 비밀번호 (Admin Password)</label>
                  <input
                    autoFocus
                    type="password"
                    maxLength={4}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                    placeholder="숫자 4자리를 입력하세요"
                    className={`w-full text-center tracking-widest text-lg font-black py-2.5 border focus:ring-0 outline-none transition-all text-slate-900 ${
                      theme === 'high-density' ? 'border-[#141414] rounded-none focus:bg-[#dfddd6]' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                    }`}
                  />
                  <p className="mt-2 text-[9px] text-zinc-400 text-center font-mono">가이드: 비밀번호는 '4714' 입니다.</p>
                </div>
              </div>
              <div className="px-6 py-4 flex gap-2 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                    theme === 'high-density' ? 'border-[#141414] hover:bg-slate-200 text-[#141414] bg-[#E7E6E1]' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                  }`}
                >
                  취소(닫기)
                </button>
                <button
                  type="button"
                  onClick={handleVerifyPassword}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white ${
                    theme === 'high-density' ? 'bg-[#141414] hover:bg-black' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100'
                  }`}
                >
                  잠금 해제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Recovery Modal */}
      <AnimatePresence>
        {isRecoveryModalOpen && pendingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-200"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">이어서 작업하시겠습니까?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  마지막으로 작업하던 <span className="font-bold text-slate-700">{pendingSession.items.length}개</span>의 내역 데이터가 남아있습니다.<br/>
                  <span className="text-xs opacity-75">저장 시각: {new Date(pendingSession.timestamp).toLocaleString()}</span>
                </p>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={restoreSession}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    이전 작업 복구하기
                  </button>
                  <button
                    onClick={discardSession}
                    className="w-full py-3 bg-white text-slate-500 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    새로 시작하기
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Local Session Recovery System v1.0</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Classification Loading Overlay */}
      <AnimatePresence>
        {isClassifying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center backdrop-blur-md bg-slate-900/60"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center text-center"
            >
              <div className="relative w-24 h-24 mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={251.2}
                    animate={{ strokeDashoffset: 251.2 * (1 - classifyProgress / 100) }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-indigo-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-xl text-slate-800">
                  {classifyProgress}%
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">AI 공정 분류 중</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Gemini AI가 내역서 항목을 분석하여<br/>
                최적의 카테고리로 자동 분류하고 있습니다.
              </p>
              
              <div className="w-full flex items-center gap-2 justify-center py-2 bg-slate-50 rounded-xl">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-600"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Processing Data</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Share Project Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60"
            onClick={() => setIsShareModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden relative ${
                theme === 'industrial' ? 'bg-slate-900 border-slate-800 text-slate-100' :
                theme === 'high-density' ? 'bg-[#F4F4F2] border-[#141414] text-[#141414]' :
                'bg-white border-slate-200 text-slate-800'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`p-6 pb-4 border-b flex items-center justify-between ${
                theme === 'industrial' ? 'border-slate-800' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-slate-50'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${
                    theme === 'industrial' ? 'bg-amber-500/10 text-amber-500' :
                    theme === 'high-density' ? 'bg-[#141414] text-white' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    <Share2 size={20} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg leading-tight ${theme === 'high-density' ? 'font-sans uppercase text-xs tracking-wider' : 'font-sans'}`}>
                      {theme === 'high-density' ? 'Project Share Link' : '프로젝트 공유하기'}
                    </h3>
                    <p className={`text-xs mt-0.5 ${theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {currentProjectName ? `'${currentProjectName}' 현장 공유` : '작업 중인 현장 공유'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === 'industrial' ? 'hover:bg-slate-800 text-slate-400' :
                    theme === 'high-density' ? 'hover:bg-black/10 text-[#141414]' :
                    'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <p className={`text-sm leading-relaxed ${theme === 'industrial' ? 'text-slate-300' : 'text-slate-600'}`}>
                  현재 분석 중인 <strong>현장 공정 분류 정보, 자재 명세 목록({items.length}개) 및 사용자 지정 카테고리</strong>가 포함된 압축 공유 링크입니다. 상대방이 이 링크를 열면 실시간으로 동일한 전체 작업본을 즉시 이식받을 수 있습니다.
                </p>

                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase tracking-wider block ${
                    theme === 'industrial' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    공유용 압축 URL
                  </label>
                  <div className={`flex gap-2 p-2 border rounded-xl items-center ${
                    theme === 'industrial' ? 'border-slate-800 bg-slate-950' :
                    theme === 'high-density' ? 'border-[#141414] bg-white text-xs' :
                    'border-slate-200 bg-slate-50'
                  }`}>
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className={`flex-grow bg-transparent border-none text-xs outline-none focus:ring-0 ${
                        theme === 'industrial' ? 'text-slate-300' : 'text-slate-600'
                      }`}
                      onClick={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.select();
                      }}
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-w-[70px] justify-center ${
                        copied
                          ? 'bg-green-600 text-white'
                          : theme === 'industrial' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' :
                            theme === 'high-density' ? 'bg-[#141414] text-white hover:opacity-90' :
                            'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check size={12} />
                          <span>복사됨</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className={`p-4 rounded-xl flex items-center justify-between border ${
                  theme === 'industrial' ? 'bg-slate-950/40 border-slate-800/80' :
                  theme === 'high-density' ? 'border-[#141414]/30 bg-[#EBEAE8]' :
                  'bg-indigo-50/40 border-indigo-100/60'
                }`}>
                  <div className="space-y-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                      theme === 'industrial' ? 'text-slate-400' : 'text-slate-400'
                    }`}>
                      Payload Summary
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      Gzip Compressed Payload State
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-indigo-600 font-mono">
                      {Math.ceil(shareUrl.length / 1024)} KB
                    </div>
                    <div className={`text-[9px] font-mono font-medium ${theme === 'industrial' ? 'text-slate-500' : 'text-slate-400'}`}>
                      URL Safe Base64
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`p-4 border-t flex justify-end gap-2 ${
                theme === 'industrial' ? 'border-slate-800' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-slate-50'
              }`}>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                    theme === 'industrial' ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' :
                    theme === 'high-density' ? 'border border-[#141414] hover:bg-black/5 text-[#141414]' :
                    'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm'
                  }`}
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Firestore Cloud Quota Exceeded Modal */}
      <AnimatePresence>
        {isQuotaModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60"
            onClick={() => setIsQuotaModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden relative ${
                theme === 'industrial' ? 'bg-slate-900 border-slate-800 text-slate-100' :
                theme === 'high-density' ? 'bg-[#F4F4F2] border-2 border-[#141414] text-[#141414]' :
                'bg-white border-slate-200 text-slate-800'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`p-6 pb-4 border-b flex items-center justify-between ${
                theme === 'industrial' ? 'border-slate-800 bg-slate-950/60' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-amber-50/60'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center">
                    <Database size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">
                      클라우드 일일 무료 할당량 안내
                    </h3>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      안전한 로컬 저장소 모드 (Local Cache Mode) 활성화됨
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-black/5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-xs leading-relaxed">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900">
                  <p className="font-semibold mb-1">
                    Firestore 일일 무료 쓰기 한도(Free Daily Write Quota)에 도달하였습니다.
                  </p>
                  <p className="opacity-90">
                    반복적인 네트워크 오류 및 성능 지연을 방지하기 위해 시스템이 자동으로 <strong>로컬 안전 저장 모드</strong>로 전환되었습니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    작업 및 데이터 안전 보장 안내
                  </h4>
                  <ul className="space-y-1.5 pl-4 list-disc text-slate-600">
                    <li>
                      <strong>데이터 100% 정상 보존</strong>: 엑셀 업로드, 공정 분류, 수식 계산, 현장 보관함 저장, JSON 백업 및 엑셀 다운로드는 브라우저 내부 스토리지(localStorage)에서 제한 없이 정상 작동합니다.
                    </li>
                    <li>
                      <strong>자동 초기화 주기</strong>: Firebase 무료 일일 할당량은 매일 <strong>00:00 (UTC)</strong>에 자동으로 리셋되며, 리셋 시 클라우드 실시간 동기화가 정상 복구됩니다.
                    </li>
                    <li>
                      <strong>기기 간 공유</strong>: 상단의 <strong>[공유하기]</strong> 버튼을 통해 URL 압축 링크를 복사하면 실시간 Firestore 없이도 다른 PC나 사용자에게 동일한 작업 상태를 즉시 전달할 수 있습니다.
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  <a
                    href={`https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID || ''}/firestore/databases/${import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'}/data?openUpgradeDialog=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors text-xs"
                  >
                    <span>Firebase 콘솔 데이터베이스 및 업그레이드 확인</span>
                    <ChevronRight size={14} />
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className={`p-4 border-t flex justify-end gap-2 ${
                theme === 'industrial' ? 'border-slate-800' :
                theme === 'high-density' ? 'border-[#141414] bg-[#EBEAE8]' :
                'border-slate-100 bg-slate-50'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  확인 및 닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Save Naming Modal */}
      <AnimatePresence>
        {isManualSaveNamingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl relative ${
                theme === 'high-density' ? 'bg-white border-2 border-[#141414]' : 'bg-white rounded-2xl border border-slate-100'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${
                theme === 'high-density' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-2">
                  <Save size={16} />
                  <h3 className="text-sm font-bold uppercase tracking-tight">새 현장 수동 저장</h3>
                </div>
                <button onClick={() => setIsManualSaveNamingOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
                  신규 현장 프로젝트명 (Site Name)
                </label>
                <input
                  autoFocus
                  type="text"
                  value={manualSaveName}
                  onChange={(e) => setManualSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmManualSave()}
                  placeholder="예: 마포 웰스트림 아파트 기계설비공사"
                  className={`w-full px-4 py-3 text-sm font-bold border focus:ring-0 outline-none transition-all text-slate-900 ${
                    theme === 'high-density' ? 'border-[#141414] rounded-none focus:bg-yellow-50' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                  }`}
                />
                <p className="mt-3 text-[10px] text-slate-500 leading-normal">
                  현재 분석 및 가공된 내역 품목 정보가 이 현장명으로 안전하게 영구 저장됩니다. 향후 '현장 보관함'에서 언제든 다시 불러올 수 있습니다.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2 border-t border-slate-50 bg-slate-50/50">
                <button
                  onClick={() => setIsManualSaveNamingOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                    theme === 'high-density' ? 'border-[#141414] hover:bg-slate-100 text-black' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmManualSave}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white transition-opacity ${
                    theme === 'high-density' ? 'bg-[#141414] hover:bg-black' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-100'
                  }`}
                >
                  저장 및 동기화
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-0 left-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border ${
              notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' :
              notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400' :
              'bg-blue-500/90 text-white border-blue-400'
            }`}
          >
            {notification.type === 'success' && (
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Project Sites & Navigation Sidebar */}
      <SiteListSidebar 
        projects={projects}
        currentProjectName={currentProjectName}
        theme={theme}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isProjectLocked={isProjectLocked}
        cloudSyncStatus={cloudSyncStatus}
        lastCloudSyncedTime={lastCloudSyncedTime}
        isQuotaExceeded={isQuotaExceededState}
        onOpenQuotaModal={() => setIsQuotaModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLoadProject={(proj) => {
          handleLoadProject(proj);
          setIsMobileSidebarOpen(false);
        }}
        onDeleteProject={handleDeleteProject}
        onAddNewProject={handleAddNewProject}
        onNewProject={() => {
          handleNewProject();
          setIsMobileSidebarOpen(false);
        }}
        onOpenCategoryManager={(tab) => {
          setCategoryManagerTab(tab);
          setIsCategoryManagerOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onOpenComparison={() => {
          setIsComparisonOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onResetTheme={() => setTheme(null)}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      {/* Main Content Area */}
      <main className={`lg:ml-72 xl:ml-80 min-h-screen flex flex-col ${theme === 'high-density' ? 'bg-white' : ''} w-full lg:w-[calc(100%-18rem)] xl:w-[calc(100%-20rem)]`}>
        {/* Mobile Navigation (Visible only when sidebar is hidden on small screens) */}
        <div className="lg:hidden flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 sticky top-0 z-40">
          <button 
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs"
          >
            <Menu size={16} />
            <span>현장 목록</span>
            {projects.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px]">
                {projects.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'list' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
              title="기본 공정분리 내역서 목록"
            >
              <FileSpreadsheet size={15} />
              <span>내역서</span>
            </button>
            <button 
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'matrix' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
              title="카테고리별 공정·구간별 집계표 (Matrix 서식)"
            >
              <Layers size={15} />
              <span>구간집계표</span>
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analysis' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
              title="단가 분석"
            >
              <BarChart3 size={15} />
              <span>단가분석</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {renderHeader()}

        <div className={theme === 'high-density' ? 'flex-grow flex flex-col overflow-hidden' : 'p-6 lg:p-10'}>
          <AnimatePresence mode="wait">
            <motion.div
              layout
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-grow flex flex-col"
            >
              {activeTab === 'list' ? (
                <>
                  <Dashboard 
                    items={items} 
                    theme={theme} 
                    onOpenSectionSummary={() => setIsSectionSummaryOpen(true)} 
                    metadata={projectMetadata}
                    onUpdateMetadata={handleUpdateProjectMetadata}
                    separationMethod={separationMethod}
                    onUpdateSeparationMethod={setSeparationMethod}
                  />
                  <CategorySummaryCards 
                    items={items} 
                    theme={theme} 
                    categories={categories}
                    categoryColors={categoryColors}
                    projectName={currentProjectName}
                    isProjectLocked={isProjectLocked}
                    categoryEstimates={categoryEstimates}
                    separationMethod={separationMethod}
                    onUpdateSeparationMethod={setSeparationMethod}
                    onCategoryClick={(cat) => setCategoryFilter(cat)}
                    onOpenStats={() => {
                      setCategoryManagerTab('stats');
                      setIsCategoryManagerOpen(true);
                    }}
                    onUpdateSafetyAmount={handleUpdateSafetyAmount}
                    onUpdateCategoryEstimate={handleUpdateCategoryEstimate}
                    onRenameCategory={handleRenameCategory}
                  />
                  {isSectionSummaryOpen && (
                    <SectionSummaryCards 
                    items={items} 
                    theme={theme} 
                    onClose={() => setIsSectionSummaryOpen(false)} 
                  />
                  )}
                  <DataTable 
                    items={items} 
                    theme={theme} 
                    categories={categories}
                    categoryColors={categoryColors}
                    workbook={workbook}
                    onClassify={handleClassify}
                    isClassifying={isClassifying}
                    onUpdateCategory={handleUpdateCategory}
                    onAddCategory={handleAddCategory}
                    onRevertCategory={handleRevertCategory}
                    onUpdateCategories={handleUpdateCategories}
                    onUpdateSections={handleUpdateSections}
                    onUpdateMemo={handleUpdateMemo}
                    onUpdateExecutionAmount={handleUpdateExecutionAmount}
                    onDataLoaded={handleDataLoaded}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                    onOpenAnalysis={() => setIsAIAnalysisDrawerOpen(true)}
                    onOrganizeSectionHierarchy={handleOrganizeSectionHierarchy}
                  />
                </>
              ) : activeTab === 'matrix' ? (
                <CategoryMatrixView 
                  items={items}
                  theme={theme}
                  categories={categories}
                  categoryColors={categoryColors}
                  projectName={currentProjectName}
                  onOpenCategoryManager={() => {
                    setCategoryManagerTab('categories');
                    setIsCategoryManagerOpen(true);
                  }}
                />
              ) : (
                <PriceAnalysis items={items} theme={theme} />
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {isComparisonOpen && (
              <ProjectComparisonModal
                onClose={() => setIsComparisonOpen(false)}
                projects={projects}
                theme={theme}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isCategoryManagerOpen && (
              <CategoryManager 
                onClose={() => setIsCategoryManagerOpen(false)}
                categories={categories}
                categoryColors={categoryColors}
                items={items}
                onUpdate={handleUpdateCategoryList}
                onUpdateColors={handleUpdateCategoryColors}
                customRules={customClassificationRules}
                onUpdateRules={handleUpdateRules}
                onApplyRules={handleApplyRules}
                initialTab={categoryManagerTab}
                autoRuleCreation={autoRuleCreation}
                onSetAutoRuleCreation={setAutoRuleCreation}
                onRenameCategory={handleRenameCategory}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSettingsOpen && (
              <SettingsManager 
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
                fontFamily={fontFamily}
                onFontFamilyChange={handleGlobalFontFamilyChange}
                fontSize={fontSize}
                onFontSizeChange={handleGlobalFontSizeChange}
                onResetData={() => {
                  setItems(SAMPLE_ITEMS);
                  showNotification('데이터가 초기 샘플로 복구되었습니다.', 'info');
                }}
              />
            )}
          </AnimatePresence>

          {/* AI Analysis Floating Button */}
          <AnimatePresence>
            {activeTab === 'list' && !isAIAnalysisDrawerOpen && (
              <motion.button
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: 20 }}
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAIAnalysisDrawerOpen(true)}
                className="fixed bottom-8 right-8 z-[150] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-[0_10px_25px_rgba(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-colors group"
                title="AI 단가 및 시스템 분석"
              >
                <Brain className="w-7 h-7" />
                <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                  자체 시스템 AI 분석 실행
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* AI Analysis Drawer */}
          <AIAnalysisDrawer 
            isOpen={isAIAnalysisDrawerOpen}
            onClose={() => setIsAIAnalysisDrawerOpen(false)}
            items={items}
            theme={theme}
            onExportXlsx={handleDownloadResults}
          />
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, theme, subtitle, onClick }: { icon: React.ReactNode, label: string, active?: boolean, theme: ThemeType, subtitle?: string, onClick?: () => void }) {
  if (theme === 'high-density') {
    return (
      <button 
        onClick={onClick}
        className={`w-full p-3 border-b border-[#141414] text-left transition-all ${
        active ? 'bg-white' : 'opacity-70 hover:bg-white/50'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-xs flex items-center gap-2">
            {icon}
            {label}
          </span>
          {active && <span className="text-[10px] bg-blue-100 text-blue-800 px-1 border border-blue-200">선택됨</span>}
        </div>
        {subtitle && <p className="text-[11px] opacity-60 leading-tight italic">{subtitle}</p>}
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}>
      {icon}
      {label}
    </button>
  );
}
