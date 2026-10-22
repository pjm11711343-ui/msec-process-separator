import React, { CSSProperties } from 'react';
import { List } from 'react-window';
import { SpecItem, ThemeType } from '../types';
import { RotateCcw } from 'lucide-react';
import { getItemQuantity } from '../utils/costCalculation';
import { getSectionHierarchyAncestors } from '../utils/sectionHierarchy';

export type VirtualRowData = 
  | { type: 'section-header'; sectionName: string; index: number; materialTotal: number; laborTotal: number; total: number; count: number; items: SpecItem[] }
  | { type: 'category-header'; catName: string; catIdx: number; materialTotal: number; laborTotal: number; total: number; count: number; items: SpecItem[] }
  | { type: 'category-sub-header'; secName: string; count: number }
  | { type: 'item'; item: SpecItem; itemIdx: number; isAggregated?: boolean };

interface VirtualizedTableBodyProps {
  rows: VirtualRowData[];
  height: number;
  theme: ThemeType;
  density: number;
  costViewType: 'total' | 'material' | 'labor';
  selectedIds: Set<string>;
  toggleOne: (id: string, index: number) => void;
  toggleAll: (items: SpecItem[]) => void;
  handleMouseDown: (id: string, index: number) => void;
  handleMouseEnter: (index: number) => void;
  renderRuleIndicator: (item: SpecItem) => React.ReactNode;
  categories: string[];
  categoryColors?: Record<string, string>;
  onUpdateCategory: (id: string, category: string) => void;
  onAddCategory: (category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateExecutionAmount: (id: string, amount: number) => void;
  editingId: { id: string, field: string } | null;
  editValue: string;
  startEditing: (id: string, field: string, value: any) => void;
  saveEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  setEditValue: (value: string) => void;
  getCellPadding: (isHeader?: boolean) => string;
}

interface ItemData {
  rows: VirtualRowData[];
  isHighDensity: boolean;
  costViewType: 'total' | 'material' | 'labor';
  borderCellClass: string;
  selectedIds: Set<string>;
  toggleOne: (id: string, index: number) => void;
  toggleAll: (items: SpecItem[]) => void;
  handleMouseDown: (id: string, index: number) => void;
  handleMouseEnter: (index: number) => void;
  renderRuleIndicator: (item: SpecItem) => React.ReactNode;
  categoryColors?: Record<string, string>;
  onUpdateCategory: (id: string, category: string) => void;
  onRevertCategory: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateExecutionAmount: (id: string, amount: number) => void;
  editingId: { id: string, field: string } | null;
  editValue: string;
  startEditing: (id: string, field: string, value: any) => void;
  saveEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  setEditValue: (value: string) => void;
}

const TableRowInner = (props: {
  index: number;
  style: CSSProperties;
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
} & ItemData) => {
  const {
    index,
    style,
    ariaAttributes,
    rows,
    isHighDensity,
    costViewType,
    borderCellClass,
    selectedIds,
    toggleOne,
    toggleAll,
    handleMouseDown,
    handleMouseEnter,
    renderRuleIndicator,
    categoryColors,
    onUpdateCategory,
    onRevertCategory,
    onUpdateMemo,
    onUpdateExecutionAmount,
    editingId,
    editValue,
    startEditing,
    saveEdit,
    handleKeyDown,
    setEditValue
  } = props;

  const row = rows[index];
  if (!row) return null;

  if (row.type === 'category-header') {
    return (
      <div 
        style={style} 
        {...ariaAttributes}
        className={`flex items-center min-w-[1816px] w-full text-xs font-bold ${
          isHighDensity ? 'bg-indigo-700 text-white border-[#141414]' : 'bg-indigo-900 text-white border-slate-800'
        } border-b select-none`}
      >
        <div className="w-[44px] shrink-0 flex items-center justify-center">
          <input 
            type="checkbox" 
            checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
            onChange={() => toggleAll(row.items)}
            className="accent-white cursor-pointer"
          />
        </div>
        <div className="w-[50px] shrink-0 font-mono font-black text-center text-[11px] text-indigo-200">
          C{row.catIdx + 1}
        </div>
        <div className="w-[556px] shrink-0 font-black uppercase tracking-wider px-3 truncate text-xs text-white">
          [분류] {row.catName}
        </div>
        <div className={`w-[182px] shrink-0 text-right font-mono font-bold px-2 text-indigo-200 text-xs ${costViewType === 'material' ? 'bg-blue-600/40' : ''}`}>
          재: ₩{row.materialTotal.toLocaleString()}
        </div>
        <div className={`w-[182px] shrink-0 text-right font-mono font-bold px-2 text-indigo-200 text-xs ${costViewType === 'labor' ? 'bg-amber-600/40' : ''}`}>
          노: ₩{row.laborTotal.toLocaleString()}
        </div>
        <div className={`w-[198px] shrink-0 text-right font-mono font-black px-2 text-amber-300 text-xs ${costViewType === 'total' ? 'bg-indigo-600/40' : ''}`}>
          합: ₩{row.total.toLocaleString()}
        </div>
        <div className="w-[604px] shrink-0 text-right font-mono text-[10px] px-4 text-indigo-200">
          {row.count} ITEMS
        </div>
      </div>
    );
  }

  if (row.type === 'category-sub-header') {
    return (
      <div 
        style={style} 
        {...ariaAttributes}
        className={`flex items-center min-w-[1816px] w-full text-[11px] font-bold ${
          isHighDensity ? 'bg-slate-100 text-slate-800' : 'bg-slate-100/90 text-slate-700'
        } border-b border-slate-200 px-2 select-none`}
      >
        <div className="w-[44px] shrink-0" />
        <div className="w-[50px] shrink-0" />
        <div className="w-[1118px] shrink-0 truncate font-mono px-3 text-slate-700">
          ↳ 공종: <span className="font-bold text-slate-900">{row.secName}</span>
        </div>
        <div className="w-[604px] shrink-0 text-right text-slate-500 font-mono px-4 text-[10px]">
          {row.count}건
        </div>
      </div>
    );
  }

  if (row.type === 'section-header') {
    const ancestors = getSectionHierarchyAncestors(row.sectionName);
    return (
      <div 
        style={style} 
        {...ariaAttributes}
        className={`flex items-center min-w-[1816px] w-full text-xs font-bold ${
          isHighDensity ? 'bg-[#0284C7] text-white border-[#141414]' : 'bg-sky-600 text-white border-sky-700'
        } border-b select-none shadow-xs`}
      >
        <div className="w-[44px] shrink-0 flex items-center justify-center">
          <input 
            type="checkbox" 
            checked={row.items.length > 0 && row.items.every(i => selectedIds.has(i.id))}
            onChange={() => toggleAll(row.items)}
            className="accent-white cursor-pointer"
          />
        </div>
        <div className="w-[50px] shrink-0 font-mono font-black text-center text-[10px] text-sky-100">
          P{row.index + 1}
        </div>
        <div className="w-[556px] shrink-0 flex flex-col justify-center px-3 overflow-hidden py-1">
          {ancestors?.breadcrumb ? (
            <div className="text-[10px] font-semibold text-sky-100/90 tracking-wide flex items-center gap-1.5 truncate leading-tight mb-0.5">
              <span className="opacity-80">📁</span>
              <span className="bg-sky-700/60 px-1.5 py-0.5 rounded text-[9.5px] border border-sky-400/30 font-mono font-medium">{ancestors.breadcrumb}</span>
            </div>
          ) : null}
          <div className="text-xs font-black uppercase tracking-wider text-white truncate leading-tight" title={row.sectionName}>
            {row.sectionName}
          </div>
        </div>
        <div className={`w-[182px] shrink-0 text-right font-mono font-bold px-2 text-sky-100 text-xs ${costViewType === 'material' ? 'bg-blue-600/40' : ''}`}>
          재: ₩{row.materialTotal.toLocaleString()}
        </div>
        <div className={`w-[182px] shrink-0 text-right font-mono font-bold px-2 text-sky-100 text-xs ${costViewType === 'labor' ? 'bg-amber-600/40' : ''}`}>
          노: ₩{row.laborTotal.toLocaleString()}
        </div>
        <div className={`w-[198px] shrink-0 text-right font-mono font-black px-2 text-amber-200 text-xs ${costViewType === 'total' ? 'bg-sky-600/40' : ''}`}>
          합: ₩{row.total.toLocaleString()}
        </div>
        <div className="w-[604px] shrink-0 text-right font-mono text-[10px] px-4 text-sky-100">
          {row.count} ITEMS
        </div>
      </div>
    );
  }

  const { item, itemIdx, isAggregated } = row;
  const isSelected = selectedIds.has(item.id);

  const ratio = item.amount > 0 ? ((item.executionAmount || 0) / item.amount) * 100 : 0;
  const ratioColorClass = ratio > 100 ? 'text-red-600' : 'text-green-600';

  return (
    <div 
      style={style}
      {...ariaAttributes}
      onMouseDown={() => handleMouseDown(item.id, index)}
      onMouseEnter={() => handleMouseEnter(index)}
      className={`flex items-center min-w-[1816px] w-full border-b text-xs select-none transition-colors ${
        isHighDensity
          ? (isSelected ? 'bg-[#C5E0B4] border-[#2d5a27]/30' : 'bg-white hover:bg-slate-50/80 border-[#141414]/15')
          : (isSelected ? 'bg-indigo-50/90 border-indigo-200' : 'bg-white hover:bg-slate-50 border-slate-100')
      } ${isSelected ? 'shadow-[inset_3px_0_0_0_#4f46e5]' : ''}`}
    >
      <div className={`w-[44px] h-full shrink-0 flex items-center justify-center ${borderCellClass}`} onClick={(e) => e.stopPropagation()}>
        {!isAggregated && (
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => toggleOne(item.id, index)}
            className={isHighDensity ? 'accent-[#141414] cursor-pointer' : 'accent-indigo-600 cursor-pointer'}
          />
        )}
      </div>

      <div className={`w-[50px] h-full shrink-0 flex items-center justify-center font-mono text-slate-500 text-[10px] ${borderCellClass}`}>
        {isAggregated ? `Σ${itemIdx + 1}` : (itemIdx + 1).toString().padStart(3, '0')}
      </div>

      <div className={`w-[230px] h-full shrink-0 flex items-center px-2.5 font-bold text-slate-900 truncate text-[11px] ${borderCellClass}`} title={item.name}>
        <span className="truncate">{item.name}</span>
      </div>

      <div className={`w-[210px] h-full shrink-0 flex items-center px-2 text-slate-600 truncate text-[11px] ${borderCellClass}`} title={item.specification}>
        <span className="truncate">{item.specification || '-'}</span>
      </div>

      <div className={`w-[48px] h-full shrink-0 flex items-center justify-center text-slate-600 text-[11px] font-medium ${borderCellClass}`}>
        {item.unit || '-'}
      </div>

      <div className={`w-[68px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-800 text-[11px] font-medium ${borderCellClass}`}>
        {getItemQuantity(item).toLocaleString()}
      </div>

      <div className={`w-[84px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-600 text-[11px] ${borderCellClass} ${costViewType === 'material' ? 'bg-blue-50/50' : ''}`}>
        ₩{(item.materialUnitPrice || 0).toLocaleString()}
      </div>

      <div className={`w-[98px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-700 text-[11px] font-medium ${borderCellClass} ${costViewType === 'material' ? 'bg-blue-50' : ''}`}>
        ₩{(item.materialAmount || 0).toLocaleString()}
      </div>

      <div className={`w-[84px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-600 text-[11px] ${borderCellClass} ${costViewType === 'labor' ? 'bg-amber-50/50' : ''}`}>
        ₩{(item.laborUnitPrice || 0).toLocaleString()}
      </div>

      <div className={`w-[98px] h-full shrink-0 flex items-center justify-end px-2 font-mono text-slate-700 text-[11px] font-medium ${borderCellClass} ${costViewType === 'labor' ? 'bg-amber-50' : ''}`}>
        ₩{(item.laborAmount || 0).toLocaleString()}
      </div>

      <div className={`w-[88px] h-full shrink-0 flex items-center justify-end px-2 font-mono font-semibold text-slate-900 bg-indigo-50/30 text-[11px] ${borderCellClass} ${costViewType === 'total' ? 'bg-indigo-100/50' : ''}`}>
        ₩{item.unitPrice.toLocaleString()}
      </div>

      <div className={`w-[110px] h-full shrink-0 flex items-center justify-end px-2 font-mono font-bold text-indigo-600 bg-amber-50/40 text-[11px] ${borderCellClass} ${costViewType === 'total' ? 'bg-amber-100/50' : ''}`}>
        ₩{item.amount.toLocaleString()}
      </div>

      <div className={`w-[104px] h-full shrink-0 flex items-center px-2 text-slate-500 italic truncate text-[10px] ${borderCellClass}`} title={item.remark}>
        <span className="truncate">{item.remark || '-'}</span>
      </div>

      <div className={`w-[130px] h-full shrink-0 flex items-center px-2 ${borderCellClass}`} onClick={(e) => e.stopPropagation()}>
        {!isAggregated ? (
          editingId?.id === item.id && editingId?.field === 'memo' ? (
            <input 
              autoFocus
              type="text" 
              value={editValue} 
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-indigo-50 border-none outline-none text-[10px] font-bold"
            />
          ) : (
            <div 
              className="w-full flex items-center justify-between cursor-text min-h-[20px]"
              onClick={() => startEditing(item.id, 'memo', item.memo || '')}
            >
              <span className="text-[10px] truncate text-slate-500 italic flex-1">
                {item.memo || ''}
              </span>
            </div>
          )
        ) : (
          <span className="text-slate-400 font-mono text-xs">-</span>
        )}
      </div>

      <div className={`w-[120px] h-full shrink-0 flex items-center px-2 ${borderCellClass}`} onClick={(e) => e.stopPropagation()}>
        {!isAggregated ? (
          editingId?.id === item.id && editingId?.field === 'executionAmount' ? (
            <input 
              autoFocus
              type="text" 
              value={editValue} 
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-amber-50 border-none outline-none text-[11px] font-black font-mono text-right"
            />
          ) : (
            <div 
              className="w-full flex items-center justify-end gap-2 cursor-text h-full"
              onClick={() => startEditing(item.id, 'executionAmount', item.executionAmount || 0)}
            >
              <span className={`text-[11px] font-black font-mono ${item.executionAmount ? 'text-amber-600' : 'text-slate-300'}`}>
                {item.executionAmount ? `₩${item.executionAmount.toLocaleString()}` : '₩0'}
              </span>
            </div>
          )
        ) : (
          <span className="text-slate-400 font-mono text-xs">-</span>
        )}
      </div>

      <div className={`w-[80px] h-full shrink-0 flex items-center justify-center font-mono font-bold text-[10px] ${borderCellClass} ${ratioColorClass}`}>
        {ratio > 0 ? `${ratio.toFixed(1)}%` : '-'}
      </div>

      <div className="w-[170px] h-full shrink-0 px-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div 
          className="w-1.5 h-4 shrink-0 rounded-full" 
          style={{ backgroundColor: (item.category && categoryColors[item.category]) || '#e2e8f0' }} 
        />
        {renderRuleIndicator(item)}
        {!isAggregated ? (
          <div className="flex items-center gap-1 flex-1 min-w-0 relative group/category">
            {editingId?.id === item.id && editingId?.field === 'category' ? (
              <input 
                autoFocus
                type="text"
                list="category-suggestions"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full p-0.5 bg-indigo-50 border border-indigo-400 rounded text-[10px] font-bold outline-none"
              />
            ) : (
              <div 
                className="w-full p-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold truncate cursor-text"
                onClick={() => startEditing(item.id, 'category', item.category || '')}
              >
                {item.category || ""}
              </div>
            )}
            {item.originalCategory && item.category !== item.originalCategory && (
              <button
                type="button"
                onClick={() => onRevertCategory(item.id)}
                className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                title={`원래 분류(${item.originalCategory})로 복구`}
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 border border-orange-100 rounded">집계됨</span>
        )}
      </div>
    </div>
  );
};

export const VirtualizedTableBody: React.FC<VirtualizedTableBodyProps> = ({
  rows,
  height,
  theme,
  density,
  costViewType,
  selectedIds,
  toggleOne,
  toggleAll,
  handleMouseDown,
  handleMouseEnter,
  renderRuleIndicator,
  categories,
  categoryColors = {},
  onUpdateCategory,
  onAddCategory,
  onRevertCategory,
  onUpdateMemo,
  onUpdateExecutionAmount,
  editingId,
  editValue,
  startEditing,
  saveEdit,
  handleKeyDown,
  setEditValue
}) => {
  const itemHeight = React.useMemo(() => 
    theme === 'high-density' ? 28 + (density - 2) * 4 : 36 + (density - 2) * 5,
    [theme, density]
  );
  
  const isHighDensity = theme === 'high-density';
  
  const borderCellClass = React.useMemo(() => 
    isHighDensity ? 'border-r border-[#141414]/15' : 'border-r border-slate-100',
    [isHighDensity]
  );

  const itemData: ItemData = React.useMemo(() => ({
    rows,
    isHighDensity,
    costViewType,
    borderCellClass,
    selectedIds,
    toggleOne,
    toggleAll,
    handleMouseDown,
    handleMouseEnter,
    renderRuleIndicator,
    categoryColors,
    onUpdateCategory,
    onRevertCategory,
    onUpdateMemo,
    onUpdateExecutionAmount,
    editingId,
    editValue,
    startEditing,
    saveEdit,
    handleKeyDown,
    setEditValue
  }), [
    rows,
    isHighDensity,
    borderCellClass,
    selectedIds,
    toggleOne,
    toggleAll,
    handleMouseDown,
    handleMouseEnter,
    renderRuleIndicator,
    categoryColors,
    onUpdateCategory,
    onRevertCategory,
    onUpdateMemo,
    onUpdateExecutionAmount,
    editingId,
    editValue,
    startEditing,
    saveEdit,
    handleKeyDown,
    setEditValue
  ]);

  const rowHeightFn = React.useCallback((index: number) => {
    const r = rows[index];
    if (r?.type === 'section-header') {
      return isHighDensity ? 42 : 46;
    }
    if (r?.type === 'category-header') {
      return isHighDensity ? 32 : 38;
    }
    if (r?.type === 'category-sub-header') {
      return isHighDensity ? 28 : 32;
    }
    return itemHeight;
  }, [rows, isHighDensity, itemHeight]);

  return (
    <div className="flex-grow bg-white overflow-hidden">
      <List<ItemData>
        rowCount={rows.length}
        rowHeight={rowHeightFn}
        rowProps={itemData}
        rowComponent={TableRowInner}
        style={{ height, width: '100%' }}
        className="custom-scrollbar"
      />
    </div>
  );
};


