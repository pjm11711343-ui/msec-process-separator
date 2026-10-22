import React, { useState, useMemo } from 'react';
import { Project, ThemeType } from '../types';
import {
  Building2,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Lock,
  Unlock,
  FolderOpen,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Tags,
  Sliders,
  LogOut,
  Cloud,
  Layers,
  ChevronRight,
  Download,
  Upload,
  Calendar,
  Package,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  projects: Project[];
  currentProjectName: string;
  theme: ThemeType;
  activeTab: 'list' | 'matrix' | 'analysis';
  setActiveTab: (tab: 'list' | 'matrix' | 'analysis') => void;
  isProjectLocked: boolean;
  cloudSyncStatus: 'synced' | 'syncing' | 'error';
  lastCloudSyncedTime: string;
  isQuotaExceeded?: boolean;
  onOpenQuotaModal?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLoadProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onAddNewProject: (name: string) => void;
  onNewProject: () => void;
  onOpenCategoryManager: (tab: 'categories' | 'rules') => void;
  onOpenComparison: () => void;
  onOpenSettings: () => void;
  onResetTheme: () => void;
  onExportBackup: () => void;
  onImportBackup: (data: any) => void;
}

export default function SiteListSidebar({
  projects,
  currentProjectName,
  theme,
  activeTab,
  setActiveTab,
  isProjectLocked,
  cloudSyncStatus,
  lastCloudSyncedTime,
  isQuotaExceeded = false,
  onOpenQuotaModal,
  isMobileOpen = false,
  onCloseMobile,
  onLoadProject,
  onDeleteProject,
  onAddNewProject,
  onNewProject,
  onOpenCategoryManager,
  onOpenComparison,
  onOpenSettings,
  onResetTheme,
  onExportBackup,
  onImportBackup
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [siteToDelete, setSiteToDelete] = useState<Project | null>(null);

  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const handleAddNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSiteName.trim()) {
      onAddNewProject(newSiteName.trim());
      setNewSiteName('');
      setIsAddingNew(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text === 'string') {
          const parsed = JSON.parse(text);
          onImportBackup(parsed);
        }
      } catch (err) {
        console.error('Failed to parse import backup JSON file', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isHighDensity = theme === 'high-density';
  const isIndustrial = theme === 'industrial';

  // Format timestamp helper
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 lg:w-80 border-r flex flex-col z-50 lg:z-30 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isIndustrial
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : isHighDensity
            ? 'bg-[#EBEAE8] border-[#141414] text-[#141414]'
            : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}
      >
        {/* Top Header / App Logo */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isIndustrial
              ? 'border-slate-800 bg-slate-950/60'
              : isHighDensity
              ? 'border-[#141414] bg-[#141414] text-white'
              : 'border-slate-100 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isIndustrial
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isHighDensity
                  ? 'bg-white text-black'
                  : 'bg-indigo-600 text-white shadow-sm'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight">MechAuto</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                    isIndustrial
                      ? 'bg-amber-500/20 text-amber-300'
                      : isHighDensity
                      ? 'bg-yellow-400 text-black'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  PRO
                </span>
              </div>
              <p
                className={`text-[10px] leading-tight ${
                  isIndustrial ? 'text-slate-400' : isHighDensity ? 'text-white/70' : 'text-slate-400'
                }`}
              >
                기계설비 공정분리 자동화
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Cloud Sync Mini Status */}
            {isQuotaExceeded ? (
              <button
                type="button"
                onClick={onOpenQuotaModal}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono border bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300 cursor-pointer transition-colors"
                title="Firestore 무료 일일 할당량 도달 - 안전한 로컬 저장소 모드 (클릭하여 안내 보기)"
              >
                <Cloud size={12} className="text-amber-400" />
                <span className="text-[10px] font-medium hidden sm:inline text-amber-300">
                  로컬모드
                </span>
              </button>
            ) : (
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono border ${
                  isIndustrial
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                    : isHighDensity
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white border-slate-200 text-slate-600 shadow-xs'
                }`}
                title="클라우드 실시간 동기화 상태"
              >
                <Cloud
                  size={12}
                  className={
                    cloudSyncStatus === 'syncing'
                      ? 'text-amber-400 animate-spin'
                      : cloudSyncStatus === 'error'
                      ? 'text-rose-500'
                      : 'text-emerald-500'
                  }
                />
                <span className="text-[10px] font-medium hidden sm:inline">
                  {cloudSyncStatus === 'syncing' ? '동기화' : '실시간'}
                </span>
              </div>
            )}

            {/* Close button on mobile */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/10"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

      {/* Main Views Navigation */}
      <div className={`p-3 border-b space-y-1 ${isIndustrial ? 'border-slate-800' : isHighDensity ? 'border-[#141414]' : 'border-slate-100'}`}>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? isIndustrial
                  ? 'bg-amber-500 text-black shadow-md'
                  : isHighDensity
                  ? 'bg-[#141414] text-white'
                  : 'bg-indigo-600 text-white shadow-sm'
                : isIndustrial
                ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white/60 hover:bg-white text-black'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="기본 공정분리 내역서 목록"
          >
            <FileSpreadsheet size={15} />
            <span>내역서</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? isIndustrial
                  ? 'bg-amber-500 text-black shadow-md'
                  : isHighDensity
                  ? 'bg-[#141414] text-white'
                  : 'bg-indigo-600 text-white shadow-sm'
                : isIndustrial
                ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white/60 hover:bg-white text-black'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="카테고리별 공정·구간별 집계표 (Matrix 서식)"
          >
            <Layers size={15} />
            <span>구간집계표</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === 'analysis'
                ? isIndustrial
                  ? 'bg-amber-500 text-black shadow-md'
                  : isHighDensity
                  ? 'bg-[#141414] text-white'
                  : 'bg-indigo-600 text-white shadow-sm'
                : isIndustrial
                ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white/60 hover:bg-white text-black'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="단가 및 금액 분석 대시보드"
          >
            <BarChart3 size={15} />
            <span>단가분석</span>
          </button>
        </div>
      </div>

      {/* Section Header: 현장 프로젝트 리스트 */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
          isIndustrial
            ? 'bg-slate-950/40 border-slate-800 text-slate-300'
            : isHighDensity
            ? 'bg-[#E0DFDC] border-[#141414] text-[#141414]'
            : 'bg-slate-50/80 border-slate-100 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Building2 size={15} className={isIndustrial ? 'text-amber-400' : isHighDensity ? 'text-black' : 'text-indigo-600'} />
          <span className="text-xs font-extrabold tracking-tight">현장 목록</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              isIndustrial
                ? 'bg-slate-800 text-amber-400 border border-slate-700'
                : isHighDensity
                ? 'bg-white text-black border border-black/20'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {projects.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
            isIndustrial
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
              : isHighDensity
              ? 'bg-[#141414] hover:bg-black text-white'
              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60'
          }`}
          title="신규 현장 추가"
        >
          <Plus size={12} />
          <span>새 현장</span>
        </button>
      </div>

      {/* Search Input Filter */}
      <div className={`p-2.5 border-b ${isIndustrial ? 'border-slate-800' : isHighDensity ? 'border-[#141414]' : 'border-slate-100'}`}>
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
            isIndustrial
              ? 'bg-slate-950 border-slate-800 text-slate-200 focus-within:border-amber-500/60'
              : isHighDensity
              ? 'bg-white border-[#141414] text-black focus-within:bg-yellow-50/50'
              : 'bg-slate-50 border-slate-200 text-slate-800 focus-within:border-indigo-500 focus-within:bg-white'
          }`}
        >
          <Search size={13} className="opacity-40 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="현장명 검색..."
            className="w-full bg-transparent border-none outline-none text-xs placeholder:text-slate-400"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="opacity-50 hover:opacity-100">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Inline New Site Add Form */}
      <AnimatePresence>
        {isAddingNew && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddNewSubmit}
            className={`p-3 border-b overflow-hidden ${
              isIndustrial
                ? 'bg-amber-500/10 border-amber-500/30'
                : isHighDensity
                ? 'bg-yellow-100 border-[#141414]'
                : 'bg-indigo-50/70 border-indigo-100'
            }`}
          >
            <div className="text-[11px] font-bold mb-1.5 text-slate-700 flex items-center justify-between">
              <span className={isIndustrial ? 'text-amber-300' : isHighDensity ? 'text-black' : 'text-indigo-900'}>
                신규 현장 프로젝트 등록
              </span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="opacity-50 hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="예: 마포 웰스트림 아파트"
              className={`w-full px-2.5 py-1.5 text-xs font-bold rounded border outline-none mb-2 ${
                isIndustrial
                  ? 'bg-slate-950 border-amber-500/40 text-white focus:border-amber-400'
                  : isHighDensity
                  ? 'bg-white border-[#141414] text-black'
                  : 'bg-white border-indigo-200 text-slate-900 focus:border-indigo-500'
              }`}
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-2.5 py-1 rounded text-[11px] font-medium opacity-70 hover:opacity-100 bg-black/10"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!newSiteName.trim()}
                className={`px-3 py-1 rounded text-[11px] font-bold text-white transition-opacity ${
                  !newSiteName.trim() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  isIndustrial
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : isHighDensity
                    ? 'bg-black text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                등록 및 열기
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Projects List Container (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Building2 className="w-8 h-8 mx-auto opacity-20 mb-2" />
            <p className="text-xs font-medium opacity-60">
              {searchTerm ? '검색된 현장이 없습니다.' : '등록된 현장이 없습니다.'}
            </p>
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <Plus size={13} />
              <span>첫 현장 등록하기</span>
            </button>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isCurrent = project.name === currentProjectName;
            const isCompleted = project.status === 'completed';
            const itemCount = project.items?.length || 0;

            return (
              <div
                key={project.id}
                onClick={() => onLoadProject(project)}
                className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isCurrent
                    ? isIndustrial
                      ? 'bg-amber-500/15 border-amber-500/70 text-white shadow-sm ring-1 ring-amber-500/30'
                      : isHighDensity
                      ? 'bg-white border-2 border-[#141414] text-black shadow-md'
                      : 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-300'
                    : isIndustrial
                    ? 'bg-slate-950/50 hover:bg-slate-800/80 border-slate-800/80 text-slate-300'
                    : isHighDensity
                    ? 'bg-white/40 hover:bg-white border-[#141414]/30 text-[#141414]'
                    : 'bg-white hover:bg-slate-50/90 border-slate-200/80 text-slate-700 hover:border-slate-300'
                }`}
              >
                {/* Active Indicator Bar */}
                {isCurrent && (
                  <div
                    className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${
                      isIndustrial ? 'bg-amber-500' : isHighDensity ? 'bg-black' : 'bg-indigo-600'
                    }`}
                  />
                )}

                <div className="flex items-start justify-between gap-1.5 pl-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`font-bold text-xs truncate leading-snug ${
                          isCurrent
                            ? isIndustrial
                              ? 'text-amber-300'
                              : isHighDensity
                              ? 'text-black'
                              : 'text-indigo-900'
                            : ''
                        }`}
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      {isCompleted ? (
                        <span
                          className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30"
                          title="내역분리 완료 (마감)"
                        >
                          <Lock size={9} />
                          완료
                        </span>
                      ) : (
                        <span
                          className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/25"
                          title="작업 진행 중"
                        >
                          <Unlock size={9} />
                          진행중
                        </span>
                      )}
                    </div>

                    {/* Metadata: Item Count & Last Updated */}
                    <div className="flex items-center gap-2 text-[10px] opacity-65 font-mono">
                      <span className="flex items-center gap-1">
                        <Package size={11} className="opacity-70" />
                        {itemCount.toLocaleString()}개 품목
                      </span>
                      {project.updatedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="opacity-70" />
                          {formatDate(project.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button (Visible on hover or mobile) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSiteToDelete(project);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-rose-500 hover:text-white ${
                      isIndustrial ? 'text-slate-400' : 'text-slate-400'
                    }`}
                    title="현장 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {siteToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setSiteToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xs p-5 rounded-2xl shadow-2xl border ${
                isIndustrial
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : isHighDensity
                  ? 'bg-white border-2 border-black text-black'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={20} />
              </div>
              <h4 className="font-bold text-sm text-center mb-1">현장 프로젝트 삭제</h4>
              <p className="text-xs text-center opacity-70 mb-4 leading-relaxed">
                '<strong>{siteToDelete.name}</strong>' 현장 및 저장된 내역({siteToDelete.items?.length || 0}개)을 클라우드에서 완전히 삭제하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSiteToDelete(null)}
                  className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProject(siteToDelete.id);
                    setSiteToDelete(null);
                  }}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  삭제 확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Bar: Settings, Rules, Themes, Backups */}
      <div
        className={`p-3 border-t space-y-1.5 ${
          isIndustrial
            ? 'border-slate-800 bg-slate-950/70'
            : isHighDensity
            ? 'border-[#141414] bg-[#E0DFDC]'
            : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onOpenComparison}
            className={`col-span-2 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
              isIndustrial
                ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 shadow-sm'
            }`}
          >
            <ArrowLeftRight size={13} />
            <span>현장 데이터 비교분석</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCategoryManager('categories')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
            }`}
          >
            <Tags size={12} />
            <span>카테고리</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCategoryManager('rules')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
            }`}
          >
            <Sliders size={12} />
            <span>분류 규칙</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
            }`}
          >
            <Settings size={12} />
            <span>설정</span>
          </button>

          <button
            type="button"
            onClick={onResetTheme}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                : isHighDensity
                ? 'bg-[#141414] text-white hover:bg-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 shadow-xs'
            }`}
            title="양식 템플릿 다시 선택"
          >
            <LogOut size={12} />
            <span>양식</span>
          </button>

          {/* Backup Export/Import */}
          <button
            type="button"
            onClick={onExportBackup}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 shadow-xs'
            }`}
            title="전체 현장 JSON 백업 내보내기"
          >
            <Download size={13} />
          </button>

          <label
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isIndustrial
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                : isHighDensity
                ? 'bg-white hover:bg-black/5 border-[#141414] text-black'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 shadow-xs'
            }`}
            title="백업 JSON 파일 불러오기"
          >
            <Upload size={13} />
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </aside>
  </>
  );
}
