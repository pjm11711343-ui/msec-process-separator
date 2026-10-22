import React, { useState } from 'react';
import { Project, ThemeType } from '../types';
import { Save, FolderOpen, Plus, Trash2, Check, X, Building2, Download, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  projects: Project[];
  currentProjectName: string;
  theme: ThemeType;
  onSave: (name: string) => void;
  onLoad: (project: Project) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onAddNewProject: (name: string) => void;
  onExportBackup: () => void;
  onImportBackup: (data: any) => void;
}

export default function ProjectSiteManager({ 
  projects, 
  currentProjectName, 
  theme, 
  onSave, 
  onLoad, 
  onDelete, 
  onNew, 
  onAddNewProject,
  onExportBackup,
  onImportBackup
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [newName, setNewName] = useState(currentProjectName);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isAddingNewProject, setIsAddingNewProject] = useState(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState('');

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName);
      setIsNaming(false);
    }
  };

  const handleAddNewProjectSubmit = () => {
    if (newProjectNameInput.trim()) {
      onAddNewProject(newProjectNameInput.trim());
      setIsAddingNewProject(false);
      setNewProjectNameInput('');
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text === 'string') {
          const parsed = JSON.parse(text);
          onImportBackup(parsed);
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Failed to parse import backup JSON file', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isHighDensity = theme === 'high-density';

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {/* Current Project Display & Actions */}
        <div className={`flex items-center gap-1 ${isHighDensity ? 'bg-white/10 p-0.5' : 'bg-slate-100 p-1.5 rounded-xl'}`}>
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-black/10 transition-colors rounded-lg overflow-hidden max-w-[180px] ${isHighDensity ? 'text-white' : 'text-slate-700'}`}
          >
            <Building2 size={16} className={isHighDensity ? 'text-blue-400' : 'text-indigo-600'} />
            <span className="text-xs font-bold truncate">
              {currentProjectName || '새 현장 프로젝트'}
            </span>
            <FolderOpen size={14} className="opacity-50" />
          </div>

          <button
            onClick={() => {
              setNewName(currentProjectName);
              setIsNaming(true);
            }}
            className={`p-1.5 rounded-lg hover:bg-black/10 transition-colors ${isHighDensity ? 'text-white' : 'text-slate-600'}`}
            title="현재 상태 저장"
          >
            <Save size={16} />
          </button>
        </div>

        <button
          onClick={() => {
            setNewProjectNameInput('');
            setIsAddingNewProject(true);
          }}
          className={`p-2 transition-all flex items-center gap-1.5 border ${
            isHighDensity 
              ? 'bg-yellow-400 text-black border-[#141414] font-black uppercase text-[9px] hover:bg-yellow-300' 
              : 'bg-white text-indigo-600 border-indigo-100 rounded-xl hover:bg-indigo-50 text-xs font-bold shadow-sm'
          }`}
          title="새로운 빈 분석 현장 추가"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">새 현장 추가</span>
        </button>
      </div>

      {/* Project Management List Popover */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`absolute top-full left-0 mt-2 w-80 z-50 shadow-2xl overflow-hidden ${
                isHighDensity 
                  ? 'bg-[#E7E6E1] border-2 border-[#141414] rounded-none' 
                  : 'bg-white border border-slate-200 rounded-2xl'
              }`}
            >
              <div className={`px-4 py-3 border-b flex justify-between items-center ${isHighDensity ? 'bg-[#141414] text-white border-[#141414]' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">분석 현장 보관함</span>
                </div>
                <button 
                  onClick={() => {
                    setNewProjectNameInput('');
                    setIsAddingNewProject(true);
                    setIsOpen(false);
                  }}
                  className={`p-1.5 hover:bg-white/10 rounded transition-colors ${isHighDensity ? 'text-blue-400' : 'text-indigo-600'}`}
                  title="새 현장 추가"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <div 
                  className={`p-3 border-b cursor-pointer hover:bg-green-50 transition-colors flex items-center gap-3 ${isHighDensity ? 'border-[#141414]/10' : 'border-slate-50'}`}
                  onClick={() => {
                    setNewName('');
                    setIsNaming(true);
                    setIsOpen(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <Save size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-green-700">현장 신규 등록 (현재 데이터 포함)</span>
                    <span className="text-[9px] opacity-60 uppercase">Save current data as new site</span>
                  </div>
                </div>

                <div 
                  className={`p-3 border-b cursor-pointer hover:bg-amber-50 transition-colors flex items-center gap-3 ${isHighDensity ? 'border-[#141414]/10' : 'border-slate-50'}`}
                  onClick={() => {
                    setNewProjectNameInput('');
                    setIsAddingNewProject(true);
                    setIsOpen(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Plus size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-amber-700">새 빈 현장 추가 (비어있는 공간)</span>
                    <span className="text-[9px] opacity-60 uppercase">Add a brand new empty site</span>
                  </div>
                </div>

                {projects.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-xs italic">저장된 현장이 없습니다.</p>
                  </div>
                ) : (
                  projects.map(p => (
                    <div 
                      key={p.id}
                      className={`group flex items-center justify-between p-4 border-b last:border-0 hover:bg-indigo-50 transition-colors cursor-pointer ${
                        currentProjectName === p.name ? (isHighDensity ? 'bg-yellow-100' : 'bg-indigo-50/50') : ''
                      }`}
                      onClick={() => {
                        onLoad(p);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">{p.name}</span>
                          {p.status === 'completed' ? (
                            <span className="px-1.5 py-0.5 text-[8px] bg-emerald-600 text-white rounded font-black uppercase flex items-center gap-0.5">
                              ✓ 완료
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[8px] bg-blue-600 text-white rounded font-black uppercase">
                              작업중
                            </span>
                          )}
                          {currentProjectName === p.name && (
                            <span className="px-1 text-[8px] bg-slate-800 text-white rounded font-black uppercase scale-90">선택됨</span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 mt-0.5">
                          저장됨: {new Date(p.updatedAt).toLocaleString()} · {p.items.length} 품목
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProjectToDelete(p);
                          }}
                          className={`p-2 transition-all rounded flex items-center gap-1.5 ${
                            isHighDensity 
                              ? 'text-red-600 hover:bg-red-600 hover:text-white border border-transparent hover:border-red-700' 
                              : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="현장 삭제"
                        >
                          <Trash2 size={14} />
                          {isHighDensity && <span className="text-[10px] font-black uppercase">현장 삭제</span>}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 백업 및 복구 제어부 */}
              <div className={`p-4 border-t flex flex-col gap-2 ${
                isHighDensity ? 'border-black bg-[#E7E6E1]/90' : 'border-slate-100 bg-slate-50/60'
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  현장 데이터 백업 및 복원
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportBackup();
                    }}
                    className={`py-2 px-3 border flex items-center justify-center gap-1.5 transition-all text-[11px] font-black cursor-pointer uppercase ${
                      isHighDensity 
                        ? 'bg-white text-black border-black hover:bg-[#dfddd6]' 
                        : 'bg-white text-indigo-700 border-indigo-100 rounded-lg hover:bg-indigo-50 shadow-sm'
                    }`}
                    title="전체 저장된 현장 리스트 전체 백업 (.json)"
                  >
                    <Download size={13} />
                    백업 다운로드
                  </button>
                  <label
                    className={`py-2 px-3 border flex items-center justify-center gap-1.5 transition-all text-[11px] font-black cursor-pointer uppercase text-center ${
                      isHighDensity 
                        ? 'bg-[#141414] text-white border-black hover:bg-black/90' 
                        : 'bg-indigo-600 text-white border-transparent rounded-lg hover:bg-indigo-700 shadow-sm'
                    }`}
                    title="내보낸 백업 파일 (.json) 가져와 복원하기"
                  >
                    <Upload size={13} />
                    백업 가져오기
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Save/Rename Modal */}
      <AnimatePresence>
        {isNaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl ${
                isHighDensity ? 'bg-white border-2 border-[#141414]' : 'bg-white rounded-2xl'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${isHighDensity ? 'bg-[#141414] text-white border-[#141414]' : 'bg-slate-50'}`}>
                <h3 className="text-sm font-bold uppercase tracking-tight">현장 정보 저장</h3>
                <button onClick={() => setIsNaming(false)}><X size={18} /></button>
              </div>
              <div className="p-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">현장 프로젝트명 (Site Name)</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="예: 과천 지식정보타운 아파트 공사"
                  className={`w-full px-4 py-3 text-sm font-bold border focus:ring-0 outline-none transition-all text-slate-900 ${
                    isHighDensity ? 'border-[#141414] rounded-none focus:bg-yellow-50' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                  }`}
                />
                <p className="mt-3 text-[10px] text-slate-500 leading-normal">
                  현재 화면에 보이는 품목 데이터와 카테고리 설정이 이 현장명으로 브라우저에 저장됩니다.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2">
                <button
                  onClick={() => setIsNaming(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                    isHighDensity ? 'border-[#141414]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white ${
                    isHighDensity ? 'bg-[#141414] hover:bg-black' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  저장하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className={`w-full max-w-sm overflow-hidden shadow-2xl border-2 ${
                isHighDensity ? 'bg-white border-[#141414]' : 'bg-white border-red-100 rounded-2xl'
              }`}
            >
              <div className={`px-6 py-4 flex justify-between items-center ${isHighDensity ? 'bg-red-600 text-white border-b-2 border-black' : 'bg-red-50 border-b border-red-100'}`}>
                <div className="flex items-center gap-2">
                  <Trash2 size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest">현장 데이터 영구 삭제</h3>
                </div>
                <button onClick={() => setProjectToDelete(null)} className="hover:rotate-90 transition-transform"><X size={18} /></button>
              </div>
              <div className="p-6">
                <div className={`mb-4 italic text-sm font-bold ${isHighDensity ? 'text-black' : 'text-slate-900'}`}>
                  "{projectToDelete.name}"
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  해당 현장에 기록된 <span className="text-red-600 font-bold">{projectToDelete.items.length}개</span>의 분석 데이터가 즉시 파기됩니다.
                  <br />
                  이 작업은 되돌릴 수 없으며, 모든 집계 내역이 소실됩니다.
                </p>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700 font-bold">
                   주의: 브라우저 캐시에서 해당 데이터가 영구적으로 지워집니다.
                </div>
              </div>
              <div className="px-6 py-4 flex gap-2 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                    isHighDensity ? 'border-[#141414] hover:bg-slate-100' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  보관 (취소)
                </button>
                <button
                  onClick={() => {
                    if (projectToDelete) {
                      onDelete(projectToDelete.id);
                      setProjectToDelete(null);
                    }
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white ${
                    isHighDensity ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200'
                  }`}
                >
                  즉시 삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Brand New Project Modal */}
      <AnimatePresence>
        {isAddingNewProject && (
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
              className={`w-full max-w-sm overflow-hidden shadow-2xl border-2 ${
                isHighDensity ? 'bg-[#E7E6E1] border-black rounded-none' : 'bg-white border-slate-100 rounded-2xl'
              }`}
            >
              <div className={`px-6 py-4 border-b flex justify-between items-center ${
                isHighDensity ? 'bg-[#141414] text-white border-b-2 border-black' : 'bg-indigo-50 border-b border-indigo-100 text-indigo-900'
              }`}>
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} className={isHighDensity ? 'text-yellow-400' : 'text-indigo-600'} />
                  새 분석 현장 추가
                </h3>
                <button onClick={() => setIsAddingNewProject(false)} className="hover:rotate-90 transition-transform">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <label className="block text-[9px] font-black uppercase text-slate-400 mb-2">새로운 현장 프로젝트명</label>
                <input
                  autoFocus
                  type="text"
                  value={newProjectNameInput}
                  onChange={(e) => setNewProjectNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewProjectSubmit()}
                  placeholder="예: 마포 더 클래시 건설현장"
                  className={`w-full px-4 py-3 text-sm font-bold border focus:ring-0 outline-none transition-all text-slate-900 ${
                    isHighDensity ? 'border-[#141414] rounded-none focus:bg-[#dfddd6]' : 'border-slate-200 rounded-xl focus:border-indigo-500'
                  }`}
                />
                <p className="mt-3 text-[10px] text-slate-500 leading-normal">
                  생성 시 기존의 작업 내역은 보관함에 안전하게 자동 저장된 상태로 유지되며, 완전히 분리된 비어있는 새로운 내역분리 작업 공간이 시작됩니다.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingNewProject(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                    isHighDensity ? 'border-[#141414] hover:bg-slate-200 text-[#141414] bg-[#E7E6E1]' : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                  }`}
                >
                  취소(닫기)
                </button>
                <button
                  type="button"
                  onClick={handleAddNewProjectSubmit}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg text-white ${
                    isHighDensity ? 'bg-[#141414] hover:bg-black' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100'
                  }`}
                >
                  현장 추가하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
