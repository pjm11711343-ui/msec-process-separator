
import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SpecItem } from '../types';
import { HierarchicalSectionTracker, normalizeAllItemsSections, extractProcessCode } from '../utils/sectionHierarchy';

interface Props {
  onDataLoaded: (items: SpecItem[], workbook: XLSX.WorkBook) => void;
  variant?: 'button' | 'dropzone';
}

export default function ExcelUpload({ onDataLoaded, variant = 'button' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 선택해도 onChange 가 발생하도록 값 초기화
    e.target.value = '';
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      alert('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
      return;
    }
    processFile(file);
  };

  const processFile = (file: File) => {

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onerror = () => {
      setIsProcessing(false);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) {
          throw new Error('파일 데이터를 읽어오지 못했습니다.');
        }

        const wb = XLSX.read(buffer, {
          type: buffer instanceof ArrayBuffer ? 'array' : 'binary',
          cellStyles: true,
          cellFormula: true,
          cellNF: true,
          sheetStubs: true
        });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to 2D array of rows (both raw values and formatted display strings)
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][];
        const formattedData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][];

        if (!data || data.length === 0) {
          throw new Error('데이터가 없거나 잘못된 형식입니다.');
        }

        // 1. Propagate merged cells across the data matrix so multi-tier headers inherit parent category names
        if (ws['!merges'] && Array.isArray(ws['!merges'])) {
          ws['!merges'].forEach(range => {
            const { s, e } = range;
            const topVal = data[s.r] && data[s.r][s.c] !== undefined ? data[s.r][s.c] : '';
            const topFormattedVal = formattedData[s.r] && formattedData[s.r][s.c] !== undefined ? formattedData[s.r][s.c] : '';
            if (topVal !== '' && topVal !== null && topVal !== undefined) {
              for (let r = s.r; r <= Math.min(e.r, data.length - 1); r++) {
                if (!data[r]) data[r] = [];
                if (!formattedData[r]) formattedData[r] = [];
                for (let c = s.c; c <= e.c; c++) {
                  if (r === s.r && c === s.c) continue;
                  // Only fill if empty
                  if (data[r][c] === '' || data[r][c] === undefined || data[r][c] === null) {
                    data[r][c] = topVal;
                  }
                  if (formattedData[r][c] === '' || formattedData[r][c] === undefined || formattedData[r][c] === null) {
                    formattedData[r][c] = topFormattedVal;
                  }
                }
              }
            }
          });
        }

        // 2. Find the header row by looking for the row with the most keyword matches
        let headerRowIndex = -1;
        let headers: string[] = [];
        let maxMatches = 0;
        const constructionKeywords = ['품명', '규격', '수량', '단위', '단가', '금액', '명칭', '비고', '재료비', '노무비', '경비', '합계', '자재비', '인건비', '품목'];
        
        for (let i = 0; i < Math.min(data.length, 40); i++) {
          const rowData = data[i];
          if (!rowData || !Array.isArray(rowData)) continue;
          
          const rowStr = rowData.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
          const matches = rowStr.filter(c => constructionKeywords.some(k => c.includes(k))).length;
          
          if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            headerRowIndex = i;
          }
        }

        // Fallback search if no strong match
        if (headerRowIndex === -1) {
          for (let i = 0; i < Math.min(data.length, 40); i++) {
            const rowData = data[i];
            if (!rowData || !Array.isArray(rowData)) continue;
            const rowStr = rowData.map(c => String(c || '').replace(/\s+/g, '').toLowerCase());
            if (rowStr.some(c => c.includes('품명') || c.includes('규격') || c.includes('수량') || c.includes('명칭') || c.includes('단위') || c.includes('재료비'))) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          throw new Error('유효한 테이블 헤더를 찾을 수 없습니다.');
        }

        // 3. Build combined headers handling 1-tier, 2-tier (parent-child), and 3-tier header designs
        const i = headerRowIndex;
        const prevRow = i > 0 ? (data[i - 1] as any[]) : null;
        const currentRow = data[i] as any[];
        const nextRow = (i + 1 < data.length) ? (data[i + 1] as any[]) : null;
        
        const maxCols = Math.max(
          currentRow ? currentRow.length : 0, 
          prevRow ? prevRow.length : 0,
          nextRow ? nextRow.length : 0
        );
        headers = new Array(maxCols).fill('');

        // Helper to check if next row is a subheader row (단가, 금액, 단위, etc.)
        let isNextRowSubHeader = false;
        if (nextRow && Array.isArray(nextRow)) {
          const nextRowMatches = nextRow.map(c => String(c || '').replace(/\s+/g, '').toLowerCase())
            .filter(s => ['단가', '금액', '단고', '계', '수량', '단위', '규격', '비고'].some(k => s.includes(k))).length;
          if (nextRowMatches >= 2) {
            isNextRowSubHeader = true;
          }
        }

        // Helper to check if prev row was a parent header row (재료비, 노무비, 합계, etc.)
        let isPrevRowParentHeader = false;
        if (prevRow && Array.isArray(prevRow)) {
          const prevRowMatches = prevRow.map(c => String(c || '').replace(/\s+/g, '').toLowerCase())
            .filter(s => ['재료비', '자재비', '노무비', '인건비', '경비', '합계', '공사비', '비목'].some(k => s.includes(k))).length;
          if (prevRowMatches >= 1) {
            isPrevRowParentHeader = true;
          }
        }

        // Forward-fill parent categories if merge metadata was missing
        if (isPrevRowParentHeader && prevRow) {
          let lastParent = '';
          for (let c = 0; c < maxCols; c++) {
            const val = prevRow[c] ? String(prevRow[c]).trim() : '';
            if (val && (val.includes('재료') || val.includes('자재') || val.includes('노무') || val.includes('인건') || val.includes('경비') || val.includes('합계') || val.includes('소계') || val.includes('공사비'))) {
              lastParent = val;
            } else if (!val && lastParent) {
              const curr = currentRow && currentRow[c] ? String(currentRow[c]).trim() : '';
              if (curr && (curr.includes('단가') || curr.includes('금액') || curr.includes('계') || curr.includes('단고'))) {
                prevRow[c] = lastParent;
              }
            }
          }
        }

        if (isNextRowSubHeader && currentRow) {
          let lastParent = '';
          for (let c = 0; c < maxCols; c++) {
            const val = currentRow[c] ? String(currentRow[c]).trim() : '';
            if (val && (val.includes('재료') || val.includes('자재') || val.includes('노무') || val.includes('인건') || val.includes('경비') || val.includes('합계') || val.includes('소계') || val.includes('공사비'))) {
              lastParent = val;
            } else if (!val && lastParent) {
              const nextVal = nextRow && nextRow[c] ? String(nextRow[c]).trim() : '';
              if (nextVal && (nextVal.includes('단가') || nextVal.includes('금액') || nextVal.includes('계') || nextVal.includes('단고'))) {
                currentRow[c] = lastParent;
              }
            }
          }
        }

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const prevVal = prevRow && prevRow[colIdx] ? String(prevRow[colIdx]).trim() : '';
          const currentVal = currentRow && currentRow[colIdx] ? String(currentRow[colIdx]).trim() : '';
          const nextVal = isNextRowSubHeader && nextRow && nextRow[colIdx] ? String(nextRow[colIdx]).trim() : '';

          let combined = '';

          if (isPrevRowParentHeader && prevVal) {
            // currentRow is subheader, prevRow is parent
            if (currentVal && !prevVal.includes(currentVal)) {
              combined = `${prevVal} ${currentVal}`;
            } else {
              combined = currentVal || prevVal;
            }
          } else if (isNextRowSubHeader && nextVal) {
            // currentRow is parent, nextRow is subheader
            if (currentVal && !currentVal.includes(nextVal)) {
              combined = `${currentVal} ${nextVal}`;
            } else {
              combined = nextVal || currentVal;
            }
          } else {
            combined = currentVal || prevVal || nextVal;
          }

          headers[colIdx] = combined;
        }

        // 4. Specific Column Matching
        const cleanHeaders = headers.map(h => (h || '').replace(/[^a-z0-9가-힣]/g, '').toLowerCase());

        const nameKeywords = [
          '품명', '항목', '공종', '명칭', '구분', '항목명', '내용', '자재명', '비목', '세부공종', '목', '자재', '공사명', 
          'item', 'description', '세부항목', '자재내역', '품목', '공명', '공종(품명)', '공종/품명'
        ];
        const specKeywords = [
          '규격', '상세', '사양', '규격및', '도면번호', '규격및사양', '형식', '규격', '사양', 'dimensions', 'size', 'spec', 'description', 
          '형명', '모델', 'model', '모델명', '규격(사양)', '규격사항', '품명(규격)', '품명/규격', '규격/사양', '규격및상세', '규격동', '동규격', 
          '규격·사양', 'specification', '규격및사양', '규격(동)', '규격·동', '규격(특기사항)', '규격·사양·형식', 'type/size', 'dimension'
        ];
        const unitKeywords = ['단위', 'unit', 'u/t'];
        const qtyKeywords = [
          '수량', '설계수량', '계약수량', '도면수량', '실행수량', '당초수량', '정산수량', '변경수량', '총수량', 
          '기성수량', '검측수량', '합계수량', '실수량', '분량', '정미수량', '수량m', '수량set', '소요량', '물량', '사용량', '정미',
          '수량계', '합계', 'qty', 'quantity', 'q\'ty', 'q.ty', 'qt\'y', 'qty.', 'q'
        ];

        const remarkKeywords = ['비고', '산출근거', '특기사항', '적요', 'remark', 'notes', '관련근거'];

        const findColByKeywords = (keywords: string[]) => {
          // 1st pass: Precise match
          for (const kw of keywords) {
            const cleanKw = kw.replace(/[^a-z0-9가-힣]/g, '').toLowerCase();
            const idx = cleanHeaders.findIndex(h => h === cleanKw);
            if (idx !== -1) return idx;
          }
          // 2nd pass: Includes match
          for (const kw of keywords) {
            const cleanKw = kw.replace(/[^a-z0-9가-힣]/g, '').toLowerCase();
            if (!cleanKw) continue;
            const idx = cleanHeaders.findIndex(h => h.includes(cleanKw));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const nameIdx = findColByKeywords(nameKeywords);
        let specIdx = findColByKeywords(specKeywords);
        const unitIdx = findColByKeywords(unitKeywords);
        const qtyIdx = findColByKeywords(qtyKeywords);
        const remarkIdx = findColByKeywords(remarkKeywords);
        const sectionKeywords = ['공종', '공정', '구간', '내역구분', '공종명', '공정명', '공정코드', '공종코드', '공종구분', '공정구분', 'section'];
        const sectionColIdx = findColByKeywords(sectionKeywords);

        // Advanced Fallback Logic for Specification Column
        if (nameIdx !== -1 && specIdx === -1) {
          for (let c = 1; c <= 3; c++) {
            const checkIdx = nameIdx + c;
            if (checkIdx < headers.length) {
              const h = cleanHeaders[checkIdx];
              const isOtherKey = [...unitKeywords, ...qtyKeywords, '단가', '금액', '재료', '노무', '합계', '비고']
                .some(k => h.includes(k.replace(/\s+/g, '').toLowerCase()));
              
              if (!isOtherKey && h.length > 0) {
                specIdx = checkIdx;
                break;
              }
            }
          }
        }
        
        if (specIdx === -1 && nameIdx !== -1 && unitIdx > nameIdx + 1) {
          specIdx = nameIdx + 1;
        }

        // 5. Robust Material, Labor, and Total Price / Amount Column Detection
        let materialPriceIdx = -1;
        let materialAmountIdx = -1;
        let laborPriceIdx = -1;
        let laborAmountIdx = -1;
        let totalPriceIdx = -1;
        let totalAmountIdx = -1;

        // Specific Material Price Keywords
        const explicitMPriceKeywords = [
          '재료비단가', '재료단가', '자재단가', '재료비단고', '자재비단가', '자제비단가', '재료비(단가)', '재료(단가)', '자재비(단가)', 
          '자재(단가)', '재료단가(원)', '재료비단가(원)', '직접재료비단가', '직접재료단가', '재료비_단가', '자재비_단가',
          'mat.unitprice', 'mat.price', 'materialprice', 'materialunitprice', 'm/p', 'm.u.p', 'mat.u/p'
        ];
        // Specific Material Amount Keywords
        const explicitMAmountKeywords = [
          '재료비금액', '재료금액', '자재금액', '자재비금액', '재료비계', '자재비계', '재료비합계', '자재비합계', '재료비(금액)', '자재비(금액)', 
          '재료금액(원)', '재료비금액(원)', '직접재료비금액', '직접재료금액', '재료비_금액', '자재비_금액', 'mat.amount', 'm/a', 'materialamount'
        ];

        // Specific Labor Price Keywords
        const explicitLPriceKeywords = [
          '노무비단가', '노무단가', '인건비단가', '노무비단고', '직접노무비단가', '직노단가', '노무비(단가)', '노무단가(원)', '노무비단가(원)', 
          '인건비(단가)', '노무비_단가', '인건비_단가', 'lab.unitprice', 'lab.price', 'laborprice', 'laborunitprice', 'l/p', 'lab.u/p'
        ];
        // Specific Labor Amount Keywords
        const explicitLAmountKeywords = [
          '노무비금액', '노무금액', '인건비금액', '노무비계', '인건비계', '노무비합계', '인건비합계', '직접노무비금액', '노무비(금액)', '인건비(금액)', 
          '노무금액(원)', '노무비금액(원)', '노무비_금액', '인건비_금액', 'lab.amount', 'l/a', 'laboramount'
        ];

        // Specific Total Price Keywords
        const explicitTotalPriceKeywords = [
          '합계단가', '총단가', '단가합계', '단가계', '종합단가', '계단가', 'totalprice', 'totalunitprice', '합계단고', '총단고'
        ];
        // Specific Total Amount Keywords
        const explicitTotalAmountKeywords = [
          '합계금액', '총금액', '금액합계', '금액계', '공사금액', '공사비', '총액', '합계액', 'totalamount', 'total'
        ];

        // First pass: exact matches
        materialPriceIdx = findColByKeywords(explicitMPriceKeywords);
        materialAmountIdx = findColByKeywords(explicitMAmountKeywords);
        laborPriceIdx = findColByKeywords(explicitLPriceKeywords);
        laborAmountIdx = findColByKeywords(explicitLAmountKeywords);
        totalPriceIdx = findColByKeywords(explicitTotalPriceKeywords);
        totalAmountIdx = findColByKeywords(explicitTotalAmountKeywords);

        // Second pass: Combined search (Material & Price, Material & Amount, etc.)
        cleanHeaders.forEach((h, idx) => {
          const isMaterial = h.includes('재료') || h.includes('자재') || h.includes('mat');
          const isLabor = h.includes('노무') || h.includes('인건') || h.includes('lab');
          const isTotal = h.includes('합계') || h.includes('총') || h.includes('계') || h.includes('소계') || h.includes('total');
          const isPrice = h.includes('단가') || h.includes('단고') || h.includes('price') || h.includes('u/p') || h.includes('up');
          const isAmount = h.includes('금액') || h.includes('amount') || h.includes('amt') || (isTotal && !isPrice);

          if (isMaterial && isPrice && materialPriceIdx === -1) materialPriceIdx = idx;
          if (isMaterial && isAmount && materialAmountIdx === -1) materialAmountIdx = idx;
          if (isLabor && isPrice && laborPriceIdx === -1) laborPriceIdx = idx;
          if (isLabor && isAmount && laborAmountIdx === -1) laborAmountIdx = idx;
          if (isTotal && isPrice && totalPriceIdx === -1) totalPriceIdx = idx;
          if (isTotal && isAmount && totalAmountIdx === -1) totalAmountIdx = idx;
        });

        // Third pass: Gather all price columns and all amount columns for positional fallback
        const allPriceCols: number[] = [];
        const allAmountCols: number[] = [];

        cleanHeaders.forEach((h, idx) => {
          if (idx === nameIdx || idx === specIdx || idx === unitIdx || idx === qtyIdx || idx === remarkIdx) return;
          if (h.includes('단가') || h.includes('단고') || h.includes('price') || h.includes('u/p') || h.includes('up')) {
            allPriceCols.push(idx);
          } else if (h.includes('금액') || h.includes('amount') || h.includes('amt') || h.includes('계')) {
            allAmountCols.push(idx);
          }
        });

        // Positional fallback for standard Korean estimate structure: [재료비, 노무비, 합계]
        if (materialPriceIdx === -1) {
          if (allPriceCols.length >= 1) materialPriceIdx = allPriceCols[0];
        }
        if (materialAmountIdx === -1) {
          if (allAmountCols.length >= 1) materialAmountIdx = allAmountCols[0];
        }

        if (laborPriceIdx === -1 && allPriceCols.length >= 2) {
          laborPriceIdx = allPriceCols[1];
        }
        if (laborAmountIdx === -1 && allAmountCols.length >= 2) {
          laborAmountIdx = allAmountCols[1];
        }

        if (totalPriceIdx === -1) {
          totalPriceIdx = allPriceCols.length >= 3 ? allPriceCols[2] : (allPriceCols.length > 0 ? allPriceCols[allPriceCols.length - 1] : -1);
        }
        if (totalAmountIdx === -1) {
          totalAmountIdx = allAmountCols.length >= 3 ? allAmountCols[2] : (allAmountCols.length > 0 ? allAmountCols[allAmountCols.length - 1] : -1);
        }

        // Positional fallback for Quantity Column
        let finalQtyIdx = qtyIdx;
        if (finalQtyIdx === -1) {
          // Fallback 1: Immediately after unit column if valid
          if (unitIdx !== -1 && unitIdx + 1 < headers.length && unitIdx + 1 !== nameIdx && unitIdx + 1 !== specIdx) {
            finalQtyIdx = unitIdx + 1;
          } else if (materialPriceIdx > 0 && materialPriceIdx - 1 !== nameIdx && materialPriceIdx - 1 !== specIdx && materialPriceIdx - 1 !== unitIdx) {
            finalQtyIdx = materialPriceIdx - 1;
          } else if (allPriceCols.length > 0 && allPriceCols[0] > 0 && allPriceCols[0] - 1 !== nameIdx && allPriceCols[0] - 1 !== specIdx && allPriceCols[0] - 1 !== unitIdx) {
            finalQtyIdx = allPriceCols[0] - 1;
          }
        }

        const finalMaterialPriceIdx = materialPriceIdx;
        const finalLaborPriceIdx = laborPriceIdx;
        const finalPriceIdx = totalPriceIdx;

        const finalMaterialAmountIdx = materialAmountIdx;
        const finalLaborAmountIdx = laborAmountIdx;
        const finalAmountIdx = totalAmountIdx;

        let currentSection = '기본 내역';
        let currentParents: string[] = [];
        const sectionTracker = new HierarchicalSectionTracker();

        // 다른 시트(집계표 등)에 있는 "코드  공종명" 목록으로 공식 공종명 등록
        const seed: { code: string; name: string }[] = [];
        wb.SheetNames.forEach(sn => {
          if (sn === wsname) return;
          const rowsOfSheet = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' }) as any[][];
          rowsOfSheet.forEach(r => (r || []).forEach(cell => {
            const m = String(cell || '').trim().match(/^(\d{6}|\d{8}|\d{10})\s+(\S.*)$/);
            if (m) seed.push({ code: m[1], name: m[2].trim() });
          }));
        });
        if (seed.length > 0) sectionTracker.seedNames(seed);
        const items: SpecItem[] = [];

        // Determine actual data start index
        const actualDataStartIndex = isNextRowSubHeader ? headerRowIndex + 2 : headerRowIndex + 1;
        const rows = data.slice(actualDataStartIndex);

        // Find optimal name column if not explicitly defined
        let finalNameIdx = nameIdx;
        if (finalNameIdx === -1) {
          for (let c = 0; c < headers.length; c++) {
            const h = headers[c] ? headers[c].toLowerCase() : '';
            if (h.includes('no') || h.includes('번호') || h.includes('순번')) continue;
            if (c !== unitIdx && c !== finalQtyIdx && c !== finalPriceIdx && c !== finalAmountIdx && c !== finalMaterialPriceIdx) {
              finalNameIdx = c;
              break;
            }
          }
        }
        if (finalNameIdx === -1) finalNameIdx = 1; // Last resort

        const cleanNum = (val: any): number => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          const trimmed = String(val).trim();
          if (trimmed === '' || trimmed === '-' || trimmed === '—' || trimmed === 'ㅡ' || trimmed === '0' || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'undefined') return 0;
          
          // Construction lump-sum units often placed in quantity column
          if (trimmed === '식' || trimmed === '일식' || trimmed === '一式' || trimmed === 'LOT' || trimmed === 'lot' || trimmed === 'SET' || trimmed === 'set' || trimmed === '조') {
            return 1;
          }

          const isNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
          const cleaned = trimmed.replace(/[₩\\,￦\s원식개EAeamM조]/g, '').replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          if (isNaN(n)) return 0;
          return isNegative ? -Math.abs(n) : n;
        };

        rows.forEach((row, idx) => {
          if (!row || !Array.isArray(row) || row.length === 0) return;

          const getValue = (colIdx: number) => {
            if (colIdx < 0 || colIdx >= row.length) return '';
            const val = row[colIdx];
            return val === undefined || val === null ? '' : String(val).trim();
          };

          const getRawValue = (colIdx: number) => {
            if (colIdx < 0) return undefined;
            const rawVal = row && colIdx < row.length ? row[colIdx] : undefined;
            if (rawVal !== undefined && rawVal !== null && rawVal !== '') return rawVal;
            // Fallback to formattedData if cell.v was empty or formula wasn't evaluated in raw mode
            const fRow = formattedData[actualDataStartIndex + idx];
            if (fRow && colIdx < fRow.length) {
              const fVal = fRow[colIdx];
              if (fVal !== undefined && fVal !== null && fVal !== '') return fVal;
            }
            return undefined;
          };

          let name = getValue(finalNameIdx);
          if (!name || name === 'null' || name === 'undefined' || name === '0' || name === '합계') return;

          // Skip obvious total rows or artifacts
          const cleanName = name.replace(/\s+/g, '');
          if (cleanName.includes('[합') || cleanName === '계' || cleanName.startsWith('Total') || cleanName.includes('페이지') || cleanName.includes('SubTotal')) return;

          let spec = getValue(specIdx);
          
          // Handle split Name/Spec in one field or column
          if (name && !spec && (name.includes('(') || name.includes('/') || name.includes('['))) {
             const match = name.match(/^(.*?)[(/[](.*?)[)\]]?$/);
             if (match) {
               name = match[1].trim();
               spec = match[2].trim();
             }
          }

          const unit = getValue(unitIdx);
          let qtyValue = cleanNum(getRawValue(finalQtyIdx !== -1 ? finalQtyIdx : -1));

          // If qtyValue is still 0, scan adjacent candidate columns (e.g. right after unit or before materialPrice)
          if (qtyValue === 0) {
            const candidateCols = [
              unitIdx !== -1 ? unitIdx + 1 : -1,
              finalQtyIdx !== -1 ? finalQtyIdx - 1 : -1,
              finalQtyIdx !== -1 ? finalQtyIdx + 1 : -1,
              finalMaterialPriceIdx > 0 ? finalMaterialPriceIdx - 1 : -1
            ].filter(c => c >= 0 && c < row.length && c !== finalNameIdx && c !== specIdx && c !== unitIdx && c !== finalMaterialPriceIdx && c !== finalMaterialAmountIdx && c !== finalLaborPriceIdx && c !== finalLaborAmountIdx && c !== finalPriceIdx && c !== finalAmountIdx);

            for (const candCol of candidateCols) {
              const val = cleanNum(getRawValue(candCol));
              if (val > 0 && val < 50000000) {
                qtyValue = val;
                break;
              }
            }
          }

          let mPriceValue = cleanNum(getRawValue(finalMaterialPriceIdx));
          let mAmountValue = cleanNum(getRawValue(finalMaterialAmountIdx));
          let lPriceValue = cleanNum(getRawValue(finalLaborPriceIdx));
          let lAmountValue = cleanNum(getRawValue(finalLaborAmountIdx));
          let rawPriceValue = cleanNum(getRawValue(finalPriceIdx));
          let rawAmountValue = cleanNum(getRawValue(finalAmountIdx));
          const remark = getValue(remarkIdx);

          // 0. Quantity derivation: If quantity is 0 but amount and price exist
          if (qtyValue === 0) {
            const totalAmt = rawAmountValue || (mAmountValue + lAmountValue);
            const totalUnitPrice = rawPriceValue || (mPriceValue + lPriceValue);
            if (totalAmt !== 0 && totalUnitPrice !== 0) {
              qtyValue = Math.round((totalAmt / totalUnitPrice) * 1000) / 1000;
            } else if (mAmountValue !== 0 && mPriceValue !== 0) {
              qtyValue = Math.round((mAmountValue / mPriceValue) * 1000) / 1000;
            } else if (lAmountValue !== 0 && lPriceValue !== 0) {
              qtyValue = Math.round((lAmountValue / lPriceValue) * 1000) / 1000;
            }
          }

          // 1. Single price/amount format fallback: If material prices are 0 but total price/amount exist and labor is 0
          if (mPriceValue === 0 && mAmountValue === 0 && lPriceValue === 0 && lAmountValue === 0) {
            if (rawPriceValue !== 0) mPriceValue = rawPriceValue;
            if (rawAmountValue !== 0) mAmountValue = rawAmountValue;
          }

          // 2. Unit price derivation from Amount and Quantity if unit price is missing
          if (mPriceValue === 0 && mAmountValue !== 0 && qtyValue > 0) {
            mPriceValue = Math.round((mAmountValue / qtyValue) * 100) / 100;
          }
          if (lPriceValue === 0 && lAmountValue !== 0 && qtyValue > 0) {
            lPriceValue = Math.round((lAmountValue / qtyValue) * 100) / 100;
          }

          // 3. Amount derivation from Unit price and Quantity if amount is missing
          if (mAmountValue === 0 && mPriceValue !== 0 && qtyValue > 0) {
            mAmountValue = Math.round(qtyValue * mPriceValue);
          }
          if (lAmountValue === 0 && lPriceValue !== 0 && qtyValue > 0) {
            lAmountValue = Math.round(qtyValue * lPriceValue);
          }

          // 4. Labor price and amount preservation
          const finalLaborPrice = lPriceValue;
          const finalLaborAmount = lAmountValue !== 0 ? lAmountValue : (lPriceValue !== 0 && qtyValue > 0 ? Math.round(qtyValue * lPriceValue) : 0);

          // 5. Total unit price (합계 단가) and Total amount (합계 금액) determination
          let priceValue = rawPriceValue;
          if (priceValue === 0) {
            if (mPriceValue !== 0 || finalLaborPrice !== 0) {
              priceValue = mPriceValue + finalLaborPrice;
            } else if (rawAmountValue !== 0 && qtyValue > 0) {
              priceValue = Math.round((rawAmountValue / qtyValue) * 100) / 100;
            }
          }

          let amountValue = rawAmountValue;
          if (amountValue === 0) {
            if (mAmountValue !== 0 || finalLaborAmount !== 0) {
              amountValue = mAmountValue + finalLaborAmount;
            } else if (priceValue !== 0 && qtyValue > 0) {
              amountValue = Math.round(qtyValue * priceValue);
            }
          }

          // If material price is 0, labor is 0, but total price exists, ensure material price reflects the item unit price
          if (mPriceValue === 0 && finalLaborPrice === 0 && priceValue !== 0) {
            mPriceValue = priceValue;
            if (mAmountValue === 0 && amountValue !== 0) {
              mAmountValue = amountValue;
            }
          }

          // 6. Comprehensive Quantity Derivation / Recovery:
          // If quantity is still 0 after all prices and amounts are calculated
          if (qtyValue === 0) {
            if (amountValue !== 0 && priceValue !== 0) {
              qtyValue = Math.round((amountValue / priceValue) * 1000) / 1000;
            } else if (mAmountValue !== 0 && mPriceValue !== 0) {
              qtyValue = Math.round((mAmountValue / mPriceValue) * 1000) / 1000;
            } else if (finalLaborAmount !== 0 && finalLaborPrice !== 0) {
              qtyValue = Math.round((finalLaborAmount / finalLaborPrice) * 1000) / 1000;
            } else if (amountValue !== 0 || mAmountValue !== 0 || finalLaborAmount !== 0) {
              const cleanUnit = (unit || '').replace(/\s+/g, '');
              if (cleanUnit === '식' || cleanUnit === 'set' || cleanUnit === 'SET' || cleanUnit === 'lot' || cleanUnit === 'LOT' || cleanUnit === '개소' || cleanUnit === '회' || cleanUnit === '조' || priceValue === amountValue || priceValue === 0) {
                qtyValue = 1;
                if (priceValue === 0) {
                  priceValue = amountValue || mAmountValue || finalLaborAmount;
                }
              }
            }
          }

          const hasQty = qtyValue !== 0;
          const hasPrice = priceValue !== 0 || mPriceValue !== 0 || finalLaborPrice !== 0 || rawPriceValue !== 0;
          const hasAmount = amountValue !== 0 || mAmountValue !== 0 || finalLaborAmount !== 0 || rawAmountValue !== 0;
          const hasNumericData = hasQty || hasPrice || hasAmount;

          // Section Detection Logic
          const isNumericTitle = /^\d+(\.\d+)*$/.test(name);
          const isSymbolSection = name.startsWith('∼') || name.startsWith('■') || name.startsWith('□') || name.startsWith('○') || name.startsWith('第');
          const isHeaderStyle = !hasNumericData && (name.length > 2 && (!unit || unit.length > 2));
          
          if (isHeaderStyle || isNumericTitle || isSymbolSection) {
            if (!hasNumericData && !unit) {
              // Check if code was in a preceding column or description in a succeeding column
              let headerText = name;
              if (!/^\d{6,12}/.test(name)) {
                for (let c = 0; c < Math.min(row.length, 4); c++) {
                  const val = String(row[c] || '').trim();
                  if (/^\d{6,12}$/.test(val)) {
                    headerText = `${val}  ${name}`;
                    break;
                  }
                }
              } else if (/^\d{6,12}$/.test(name)) {
                // Name is just the code, check if subsequent column has the process/unit description
                for (let c = finalNameIdx + 1; c < Math.min(row.length, finalNameIdx + 4); c++) {
                  const val = String(row[c] || '').trim();
                  if (val && !/^\d+(\.\d+)*$/.test(val) && val !== 'null' && val !== 'undefined') {
                    headerText = `${name}  ${val}`;
                    break;
                  }
                }
              }

              currentSection = sectionTracker.handleHeaderRow(headerText, spec);
              currentParents = sectionTracker.getLastParents();
              return;
            }
          }

          // Custom Categorization Logic based on user request
          let autoCategory = '';
          const lowerName = name.toLowerCase();
          const lowerSection = currentSection.toLowerCase();
          
          if (lowerName.includes('배관용탄소강관')) {
            autoCategory = '백강관';
          } else if (lowerName.includes('기계터파기') || lowerName.includes('기계되메우기') || lowerName.includes('모래부설')) {
            autoCategory = '기타자재';
          } else if (lowerName.includes('압력계설치') || lowerName.includes('부동급수전')) {
            autoCategory = '밸브류';
          } else if (lowerName.includes('녹막이페인트칠')) {
            autoCategory = '소모잡자재';
          } else if (lowerName.includes('보일러하부배관고정크램프')) {
            autoCategory = '마감자재';
          } else if (lowerName.includes('플랜지')) {
            if (spec.toLowerCase().includes('pvc')) {
              autoCategory = 'PVC';
            } else {
              autoCategory = '강관부속';
            }
          } else if (lowerName.includes('기계실 잡철물') || lowerName.includes('ㄱ형강')) {
            autoCategory = '조립식가대';
          } else if (lowerName.includes('수도용앵글밸브') || lowerName.includes('세대역류방지밸브')) {
            autoCategory = '통합거치대';
          } else if (lowerName.includes('원형수전브라켓')) {
            autoCategory = 'PB';
          } else if (lowerSection.includes('기계실환기덕트')) {
            const outsourcingKeywords = [
              '각형덕트', '캔버스', '점검구', '동망', '유성페인트', '녹막이페인트',
              'B.D.D', 'GRILLE', 'F.D', 'REGISTER', '노무비'
            ];
            if (outsourcingKeywords.some(k => lowerName.includes(k.toLowerCase()))) {
              autoCategory = '외주';
            }
          } else if (lowerName.includes('공구손료')) {
            const outsourcingSections = [
              '부대시설전열교환기공사',
              '부대시설환기덕트설치공사',
              '근생환기덕트설치공사',
              '전열교환기 설치공사',
              '기계실환기덕트설치공사'
            ];
            if (outsourcingSections.some(sec => lowerSection.includes(sec.toLowerCase()))) {
              autoCategory = '외주';
            } else {
              autoCategory = '공구손료';
            }
          } else if (lowerSection.includes('단위세대')) {
            const s = spec.toLowerCase().replace(/\s+/g, '');
            if (lowerSection.includes('난방배관공사') || lowerSection.includes('01010401') || lowerSection.includes('01010405') || lowerSection.includes('세대내배관공사')) {
              if (lowerName.includes('폴리부틸렌관')) {
                autoCategory = 'PB';
              } else if (lowerName.includes('목긴볼밸브')) {
                autoCategory = '밸브류';
              }
            }
            
            if (!autoCategory && lowerSection.includes('난방배관공사')) {
              if (lowerName.includes('폴리부틸렌관') && (s.includes('pb엘보d20') || s.includes('pbf밸브소켓d20') || s.includes('pbm밸브소켓d20'))) {
                autoCategory = 'PB';
              } else if (lowerName.includes('목긴볼밸브') && s.includes('황동,10kg,d20')) {
                autoCategory = '밸브류';
              }
            }
            
            if (!autoCategory) {
              if (lowerName.includes('폴리부틸렌관') && s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d15')) {
                autoCategory = '난방코일';
              } else if (lowerName.includes('폴리부틸렌관') && (s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d20') || s.includes('pb서포트스리브'))) {
                autoCategory = 'PB';
              } else if (
                lowerName.includes('sts강관이음쇠') || 
                lowerName.includes('폴리부틸렌관') || 
                lowerName.includes('폴리부틸렌') || 
                lowerName.includes('pb') || 
                lowerName.includes('목긴볼밸브') || 
                lowerName.includes('통합거치대') ||
                lowerName.includes('분기관') ||
                lowerName.includes('압력계') ||
                lowerName.includes('수도계량기') ||
                lowerName.includes('링죠인트') ||
                lowerName.includes('리듀서') ||
                s.includes('pb엘보') ||
                s.includes('pb티이') ||
                s.includes('pb수전엘보') ||
                s.includes('pbf밸브소켓') ||
                s.includes('pbm밸브소켓') ||
                lowerName.includes('세대일체형브라켓')
              ) {
                autoCategory = '통합거치대';
              }
            }
          } else if (lowerName.includes('폴리부틸렌관') || spec.toLowerCase().includes('pb서포트스리브')) {
            autoCategory = 'PB';
          } else if (lowerName.includes('강관스리브') || lowerName.includes('pvc스리브') || lowerName.includes('볼텍스') || lowerName.includes('이중배관소켓') || (spec.toLowerCase().includes('스리브') && !spec.toLowerCase().includes('pb서포트스리브'))) {
            autoCategory = '스리브';
          } else if (lowerSection.includes('주차장환기덕트설치공사')) {
            if (lowerName.includes('유성페인트') || lowerName.includes('녹막이페인트')) {
              autoCategory = '외주';
            }
          } else if (lowerName.includes('멀티캡')) {
            autoCategory = '마감자재';
          } else if (lowerName.includes('난연이중크린호스y분기관')) {
            autoCategory = '외주';
          } else if (lowerName.includes('시스템가대브라켓') || lowerName.includes('조립식찬넬설치공사') || lowerName.includes('시스템찬넬')) {
            autoCategory = '조립식가대';
          } else if (lowerSection.includes('조립식찬넬설치공사') && lowerName.includes('그외부속류')) {
            autoCategory = '조립식가대';
          } else if (lowerName.includes('무용접스텐')) {
            if (lowerName.includes('난방') || lowerSection.includes('난방')) {
              autoCategory = 'STS난방부속';
            } else {
              autoCategory = 'STS위생부속';
            }
          } else if (lowerName.includes('스텐관용접')) {
            if (lowerName.includes('난방') || lowerSection.includes('난방')) {
              autoCategory = 'STS난방부속';
            } else {
              autoCategory = 'STS위생부속';
            }
          }

          // If it has a name and at least one characteristic of a real item
          if (name && (hasNumericData || unit || spec)) {
            let finalItemQty = qtyValue;
            if (finalItemQty <= 0) {
              const totalA = amountValue || mAmountValue || finalLaborAmount;
              const totalP = priceValue || mPriceValue || finalLaborPrice;
              if (totalA > 0 && totalP > 0) {
                finalItemQty = Math.round((totalA / totalP) * 1000) / 1000;
              } else if (totalA > 0) {
                finalItemQty = 1;
              }
            }

            let itemSection = currentSection;
            let itemParents = currentParents;
            if (sectionColIdx !== -1) {
              const explicitSection = String(row[sectionColIdx] || '').trim();
              // '세부공종' 처럼 자재 구분값이 들어있는 칸은 공정이 아니므로, 공정코드가 있는 값만 공정으로 사용
              if (explicitSection && explicitSection !== 'null' && explicitSection !== 'undefined' && extractProcessCode(explicitSection)) {
                itemSection = sectionTracker.handleHeaderRow(explicitSection);
                itemParents = sectionTracker.getLastParents();
              }
            }

            items.push({
              id: `excel-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name,
              specification: spec,
              unit,
              quantity: finalItemQty,
              materialUnitPrice: mPriceValue,
              materialAmount: mAmountValue !== 0 ? mAmountValue : (finalItemQty > 0 && mPriceValue !== 0 ? Math.round(finalItemQty * mPriceValue) : 0),
              laborUnitPrice: finalLaborPrice,
              laborAmount: finalLaborAmount,
              unitPrice: priceValue,
              amount: amountValue !== 0 ? amountValue : (finalItemQty > 0 && priceValue !== 0 ? Math.round(finalItemQty * priceValue) : 0),
              category: autoCategory,
              section: itemSection,
              remark: (remark === 'null' || remark === 'undefined') ? '' : remark,
              excelRowIdx: actualDataStartIndex + idx,
              sectionParent: itemParents.join(' › ')
            });
          }
        });

        if (items.length === 0) {
          throw new Error('불러올 수 있는 내역 데이터가 없습니다.');
        }

        // Normalize all item sections hierarchically (e.g. 0101040102 세대내 난방 배관공사 76㎡ 단위세대)
        const { items: normalizedItems } = normalizeAllItemsSections(items);

        onDataLoaded(normalizedItems, wb);
      } catch (error: any) {
        console.error('Excel processing error:', error);
        alert(`업로드 실패: ${error.message}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (variant === 'dropzone') {
    return (
      <div 
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all bg-white group ${
          isProcessing ? 'border-indigo-300 bg-indigo-50 cursor-wait' : isDragOver ? 'border-indigo-500 bg-indigo-50 cursor-copy' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={isProcessing}
        />
        <div className={`p-4 rounded-full transition-transform ${isProcessing ? 'bg-white shadow-sm' : 'bg-indigo-50 group-hover:scale-110'}`}>
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <div className="text-center px-4">
          <p className="text-slate-900 font-bold">
            {isProcessing ? '파일 데이터를 정밀 분석 중입니다' : '엑셀 계약 내역서 업로드'}
          </p>
          <p className="text-slate-400 text-sm mt-1 max-w-xs">
            {isProcessing ? '대용량 파일의 경우 수 초가 걸릴 수 있습니다.' : '파일을 드래그하거나 클릭하여 시작하세요'}
          </p>
        </div>
        {!isProcessing && (
          <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-indigo-400" /> Auto Detection</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-indigo-400" /> AI Ready</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        disabled={isProcessing}
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm text-sm font-medium ${
          isProcessing 
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-wait' 
            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
        }`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {isProcessing ? '처리 중...' : '내역서 업로드'}
      </button>
    </>
  );
}
