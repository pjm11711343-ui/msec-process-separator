import React from 'react';
import { X, Settings, Database, Zap, Palette, Trash2, AlertTriangle } from 'lucide-react';
import { ThemeType, AppConfig } from '../types';

interface Props {
  onClose: () => void;
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onResetData: () => void;
}

export default function SettingsManager({ 
  onClose, 
  theme, 
  onThemeChange, 
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  onResetData 
}: Props) {
  // Keep track of the initial font family when modal opened to support Cancel/Revert action
  const [initialFont] = React.useState(fontFamily);
  const [tempFontFamily, setTempFontFamily] = React.useState(fontFamily);
  const [isPreviewEnabled, setIsPreviewEnabled] = React.useState(true);

  // Sync with main application when preview is toggled/changed
  React.useEffect(() => {
    if (isPreviewEnabled) {
      onFontFamilyChange(tempFontFamily);
    } else {
      onFontFamilyChange(initialFont);
    }
  }, [tempFontFamily, isPreviewEnabled, onFontFamilyChange, initialFont]);

  const handleSaveAndClose = () => {
    // Apply final selected font family permanently
    onFontFamilyChange(tempFontFamily);
    onClose();
  };

  const handleCancelAndClose = () => {
    // Revert parent font back to what it was initially
    onFontFamilyChange(initialFont);
    onClose();
  };

  const fontOptions = [
    { name: '굴림 (Default)', value: '"Gulim", "굴림", Dotum, "돋움", sans-serif' },
    { name: '돋움', value: 'Dotum, "돋움", sans-serif' },
    { name: '맑은 고딕', value: '"Malgun Gothic", "맑은 고딕", sans-serif' },
    { name: '바탕', value: 'Batang, "바탕", serif' },
    { name: 'Inter (System)', value: '"Inter", sans-serif' },
    { name: 'Mono (Standard)', value: '"JetBrains Mono", monospace' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">시스템 설정</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">System Configuration</p>
            </div>
          </div>
          <button onClick={handleCancelAndClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="닫기 (변경점 취소)">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-grow space-y-8">
          {/* Theme Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Palette className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">인터페이스 테마</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'modern', name: 'Standard Modern', desc: '표준 깔끔한 디자인' },
                { id: 'high-density', name: 'High Density', desc: '산업용 고밀도 레이아웃' },
                { id: 'industrial', name: 'Industrial Dark', desc: '눈이 편한 다크 모드' },
                { id: 'minimal', name: 'Minimalist', desc: '최소한의 간결함' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id as ThemeType)}
                  className={`flex flex-col p-4 rounded-2xl border-2 transition-all text-left ${
                    theme === t.id 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                  }`}
                >
                  <span className={`font-bold text-sm ${theme === t.id ? 'text-indigo-600' : 'text-slate-700'}`}>{t.name}</span>
                  <span className="text-[11px] text-slate-400 mt-1">{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Typography Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Zap className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">타이포그래피 설정</h3>
            </div>
            
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-5">
              {/* Font Family Selection */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">글꼴 (Font Family)</label>
                <select 
                  value={tempFontFamily}
                  onChange={(e) => setTempFontFamily(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                >
                  {fontOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.name}</option>
                  ))}
                </select>
              </div>

              {/* Font Preview Controls & Live Specimen Box */}
              <div className="pt-3 border-t border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">전체 실시간 앱 미리보기</span>
                    <span className="text-[10px] text-slate-400">활성화 시 변경사항이 전체 화면에 즉시 적용됩니다</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewEnabled(!isPreviewEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPreviewEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isPreviewEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Font Specimen Box */}
                <div 
                  className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 select-none shadow-sm transition-all"
                  style={{ fontFamily: tempFontFamily }}
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1 text-[10px]">
                    <span className="font-extrabold uppercase text-indigo-600 tracking-wider">
                      글꼴 미리보기 표본 (PREVIEW SAMPLE)
                    </span>
                    <span className="text-slate-400 opacity-85 font-semibold">
                      {fontOptions.find(opt => opt.value === tempFontFamily)?.name || '사용자 설정'}
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-800 leading-snug">
                    기계설비 공정분리 및 일위대가 내역분리 지능형 마스터
                  </p>
                  <p className="text-xs text-slate-500 leading-normal font-bold">
                    본 시스템은 실시간 데이터 백업 및 복원, 고강도 엑셀 파싱 분석을 지원합니다.
                  </p>
                  <p className="text-[11px] text-slate-400 tracking-wider font-semibold">
                    가나다라마바사 아자차카타파하 ABCDEFGHIJKLMNOPQRSTUVWXYZ 1234567890
                  </p>
                </div>
              </div>

              {/* Font Size */}
              <div className="pt-3 border-t border-slate-200/60">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">글자 크기 (Font Size)</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onFontSizeChange(Math.max(8, fontSize - 0.5))}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 active:scale-95 transition-all font-bold"
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      min="8"
                      max="24"
                      step="0.5"
                      value={fontSize}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onFontSizeChange(val);
                        }
                      }}
                      className="w-16 p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button 
                      onClick={() => onFontSizeChange(Math.min(24, fontSize + 0.5))}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 active:scale-95 transition-all font-bold"
                    >
                      +
                    </button>
                    <span className="text-xs font-bold text-slate-400 ml-1">px</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1 px-1">
                  <span>최소 (8px)</span>
                  <span>기본 (11px)</span>
                  <span>최대 (24px)</span>
                </div>
              </div>
            </div>
          </section>

          {/* AI/Performance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Zap className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">AI 프로세싱 성능</h3>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Turbo Processing Mode</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Gemini AI의 병렬 처리 속도를 최대로 높입니다.</p>
                </div>
                <div className="relative w-12 h-6 bg-indigo-600 rounded-full">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-100/50 rounded-lg border border-indigo-200/50">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">AI Agent Active: GPT-4o / Gemini 1.5 Pro</span>
              </div>
            </div>
          </section>

          {/* Data Management Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Database className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold underline decoration-indigo-200 decoration-4 underline-offset-4">데이터 및 캐시 관리</h3>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  if (window.confirm('모든 로컬 데이터를 초기화하시겠습니까? (샘플 데이터로 복구됨)')) {
                    onResetData();
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl border border-red-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 group-hover:shake" />
                  <div className="text-left">
                    <p className="font-bold text-sm">로컬 데이터 전체 삭제</p>
                    <p className="text-[11px] opacity-70">현재 작업 중인 모든 내역서 데이터가 제거됩니다.</p>
                  </div>
                </div>
                <AlertTriangle className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={handleCancelAndClose}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 hover:text-slate-800 transition-all"
          >
            취소 및 닫기
          </button>
          <button 
            onClick={handleSaveAndClose}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200"
          >
            설정 저장 및 적용
          </button>
        </div>
      </div>
    </div>
  );
}
