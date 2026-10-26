import ExcelJS from 'exceljs';
import { SpecItem } from '../types';
import { 
  getItemMaterialCost, 
  getItemLaborCost, 
  getItemContractAmount, 
  isExcludedFromMaterialCost,
  isOutsourcingCategory,
  isIndirectCostCategory,
  isClientSuppliedCategory
} from './costCalculation';
import { extractProcessCode, LEVEL_1_PROCESS_NAMES, LEVEL_2_PROCESS_NAMES, buildSectionDisplayInfo, buildMatrixHeaderLookup, matrixHeaderFor } from './sectionHierarchy';

interface ExportOptions {
  projectName?: string;
  items: SpecItem[];
  categories?: string[];
  hidePriceAndAmount?: boolean;
  autoHideEmptySectionCols?: boolean;
}

export async function exportStyledExcel({
  projectName = '기계설비_공정분리',
  items,
  categories = [],
  hidePriceAndAmount = false,
  autoHideEmptySectionCols = true
}: ExportOptions): Promise<void> {
  // 집계표 열 머리글: 현장 데이터의 실제 공종명 사용
  const headerLookup = buildMatrixHeaderLookup(items);
  if (!items || items.length === 0) {
    throw new Error('내보낼 데이터가 없습니다.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '기계설비 공정분리 마스터';
  workbook.lastModifiedBy = '기계설비 공정분리 마스터';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper for formatting currency amounts
  const formatCurrency = (val: number | undefined | null) => (val !== undefined && val !== null ? val : 0);

  // Calculate totals
  const totalMaterialAmount = items.reduce((sum, item) => sum + getItemMaterialCost(item), 0);
  const totalLaborAmount = items.reduce((sum, item) => sum + getItemLaborCost(item), 0);
  const totalGrandAmount = items.reduce((sum, item) => sum + getItemContractAmount(item), 0);
  const dateString = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  /* ==========================================================================
     1. SHEET 1: 공정분리_내역서 (Detailed Sheet with Real Styles)
     ========================================================================== */
  const detailSheet = workbook.addWorksheet('공정분리_내역서', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
  });

  // Title Row (Row 1)
  detailSheet.mergeCells('A1:O1');
  const titleCell = detailSheet.getCell('A1');
  titleCell.value = `기계설비 공정분리 명세서 [ ${projectName} ]`;
  titleCell.font = { name: '맑은 고딕', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Dark Slate Navy
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  detailSheet.getRow(1).height = 36;

  // Metadata Row (Row 2)
  detailSheet.mergeCells('A2:H2');
  const metaCellLeft = detailSheet.getCell('A2');
  metaCellLeft.value = `현장명: ${projectName}  |  총 품목수: ${items.length.toLocaleString()}개`;
  metaCellLeft.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF475569' } };
  metaCellLeft.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  metaCellLeft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  detailSheet.mergeCells('I2:O2');
  const metaCellRight = detailSheet.getCell('I2');
  metaCellRight.value = `출력일자: ${dateString}  |  총 공사금액: ₩${totalGrandAmount.toLocaleString()}`;
  metaCellRight.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
  metaCellRight.alignment = { horizontal: 'right', vertical: 'middle' };
  metaCellRight.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  detailSheet.getRow(2).height = 22;

  // Blank spacing row (Row 3)
  detailSheet.getRow(3).height = 6;

  // Header Row (Row 4)
  const headers = [
    { header: '순번', key: 'no', width: 8 },
    { header: '공종 구분', key: 'section', width: 22 },
    { header: '품명', key: 'name', width: 34 },
    { header: '규격', key: 'specification', width: 28 },
    { header: '단위', key: 'unit', width: 9 },
    { header: '수량', key: 'quantity', width: 13 },
    { header: '재료비 단가', key: 'materialUnitPrice', width: 16 },
    { header: '재료비 금액', key: 'materialAmount', width: 18 },
    { header: '노무비 단가', key: 'laborUnitPrice', width: 16 },
    { header: '노무비 금액', key: 'laborAmount', width: 18 },
    { header: '합계 단가', key: 'unitPrice', width: 16 },
    { header: '합계 금액', key: 'amount', width: 19 },
    { header: '자재 분류', key: 'category', width: 18 },
    { header: '비고', key: 'remark', width: 20 },
    { header: '메모', key: 'memo', width: 22 }
  ];

  const headerRow = detailSheet.getRow(4);
  headerRow.values = headers.map(h => h.header);
  headerRow.height = 28;

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF0F172A' } },
    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } }
  };

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = headerBorder;

    // Special header colors for material, labor, total
    if (colNumber === 7 || colNumber === 8) {
      // Material headers: Deep Indigo
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    } else if (colNumber === 9 || colNumber === 10) {
      // Labor headers: Slate Blue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    } else if (colNumber === 11 || colNumber === 12) {
      // Total headers: Dark Amber/Teal
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    } else if (colNumber === 13) {
      // Category header: Purple
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B21B6' } };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    }
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // Populate data rows
  let currentRowIndex = 5;

  // Helper to write a hierarchical header row matching Image 2
  const writeHierarchyHeader = (text: string, bgColor: string, fontSize: number = 9.5) => {
    const headerRow = detailSheet.getRow(currentRowIndex);
    headerRow.height = 22;

    // Merge A to E (No., Section, Name, Spec, Unit) for the process header title
    detailSheet.mergeCells(`A${currentRowIndex}:E${currentRowIndex}`);
    const mainCell = detailSheet.getCell(`A${currentRowIndex}`);
    mainCell.value = text;
    mainCell.font = { name: '맑은 고딕', size: fontSize, bold: true, color: { argb: 'FF141414' } };
    mainCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    for (let c = 1; c <= 15; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = thinBorder;
    }

    currentRowIndex++;
  };

  // Group items by (상위 공정 경로 + 공정) preserving sequence
  const displayInfo = buildSectionDisplayInfo(items);
  const sectionGroups: { section: string; parents: string[]; title: string; items: SpecItem[] }[] = [];
  const sectionSeenMap = new Map<string, number>();

  items.forEach(item => {
    const sec = item.section || '기본 내역';
    const info = displayInfo.get(item.id);
    const key = info?.key || sec;
    if (!sectionSeenMap.has(key)) {
      sectionSeenMap.set(key, sectionGroups.length);
      sectionGroups.push({ section: sec, parents: info?.parents || [], title: info?.title || sec, items: [item] });
    } else {
      sectionGroups[sectionSeenMap.get(key)!].items.push(item);
    }
  });

  let globalItemIndex = 1;

  // Populate data rows grouped by section with repeated main process headers
  sectionGroups.forEach(group => {
    if (group.parents.filter(p => !/^\d{4}\s/.test(p)).length > 0) {
      // 상위 공정을 공정마다 반복: 대공종(연녹색) → 소공종(흰색) … → 해당 공정
      group.parents.filter(p => !/^\d{4}\s/.test(p)).forEach((parent, pIdx) => {
        writeHierarchyHeader(parent, pIdx === 0 ? 'FFE2EFDA' : 'FFFFFFFF', pIdx === 0 ? 10 : 9.5);
      });
      writeHierarchyHeader(group.title, 'FFF8FAFC', 9.5);
    } else {
      // 최상위 공정
      writeHierarchyHeader(group.title, 'FFE2EFDA', 10);
    }

    // Populate item rows under this section
    group.items.forEach(item => {
      const row = detailSheet.getRow(currentRowIndex);
      const isExcluded = isExcludedFromMaterialCost(item.category);
      const mUnitPrice = isExcluded ? 0 : formatCurrency(item.materialUnitPrice);
      const mAmount = getItemMaterialCost(item);

      const lUnitPrice = isExcluded && (!item.laborUnitPrice || item.laborUnitPrice === 0) && item.quantity > 0
        ? Math.round(getItemLaborCost(item) / item.quantity)
        : formatCurrency(item.laborUnitPrice);
      const lAmount = getItemLaborCost(item);

      const uPrice = formatCurrency(item.unitPrice);
      const totAmount = getItemContractAmount(item);

      row.values = [
        globalItemIndex++,
        item.section || group.section,
        item.name || '',
        item.specification || '',
        item.unit || '',
        item.quantity || 0,
        mUnitPrice,
        mAmount,
        lUnitPrice,
        lAmount,
        uPrice,
        totAmount,
        item.category || '미분류',
        item.remark || '',
        item.memo || ''
      ];

      const isEven = (globalItemIndex - 1) % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: '맑은 고딕', size: 9.5 };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

        // Number formatting & Alignments
        switch (colNumber) {
          case 1: // No.
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF64748B' } };
            break;
          case 2: // Section
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FF334155' } };
            break;
          case 3: // Name
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
            break;
          case 4: // Spec
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
            break;
          case 5: // Unit
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            break;
          case 6: // Quantity
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = Number.isInteger(item.quantity) ? '#,##0' : '#,##0.00';
            cell.font = { name: '맑은 고딕', size: 9.5, bold: true };
            break;
          case 7: // Material Unit Price
          case 9: // Labor Unit Price
          case 11: // Total Unit Price
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
            cell.font = { name: '맑은 고딕', size: 9 };
            break;
          case 8: // Material Amount
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
            cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
            break;
          case 10: // Labor Amount
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
            cell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
            break;
          case 12: // Total Amount
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
            cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F766E' } };
            break;
          case 13: // Category
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            const isUnclassified = !item.category || item.category === '미분류';
            cell.font = {
              name: '맑은 고딕',
              size: 9.5,
              bold: true,
              color: { argb: isUnclassified ? 'FFB45309' : 'FF4338CA' }
            };
            if (isUnclassified) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            }
            break;
          case 14: // Remark
          case 15: // Memo
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: '맑은 고딕', size: 8.5, color: { argb: 'FF64748B' } };
            break;
        }
      });

      currentRowIndex++;
    });
  });

  // Grand Total Summary Row
  const totalRow = detailSheet.getRow(currentRowIndex);
  totalRow.height = 30;

  detailSheet.mergeCells(`A${currentRowIndex}:E${currentRowIndex}`);
  const totalLabelCell = detailSheet.getCell(`A${currentRowIndex}`);
  totalLabelCell.value = '합계 (GRAND TOTAL)';
  totalLabelCell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(6).value = { formula: `SUM(F5:F${currentRowIndex - 1})`, result: items.reduce((sum, item) => sum + (item.quantity || 0), 0) };
  totalRow.getCell(6).numFmt = '#,##0';

  totalRow.getCell(7).value = '-';
  totalRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(8).value = { formula: `SUM(H5:H${currentRowIndex - 1})`, result: totalMaterialAmount };
  totalRow.getCell(8).numFmt = '#,##0';

  totalRow.getCell(9).value = '-';
  totalRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(10).value = { formula: `SUM(J5:J${currentRowIndex - 1})`, result: totalLaborAmount };
  totalRow.getCell(10).numFmt = '#,##0';

  totalRow.getCell(11).value = '-';
  totalRow.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(12).value = { formula: `SUM(L5:L${currentRowIndex - 1})`, result: totalGrandAmount };
  totalRow.getCell(12).numFmt = '#,##0';

  totalRow.getCell(13).value = `${items.length}개 품목`;
  totalRow.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(14).value = '';
  totalRow.getCell(15).value = '';

  const totalBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; // Light Indigo
    cell.border = totalBorder;

    if (colNumber === 8) {
      cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
    } else if (colNumber === 12) {
      cell.font = { name: '맑은 고딕', size: 11.5, bold: true, color: { argb: 'FF0F766E' } };
    }
  });

  // Set explicit column widths
  headers.forEach((col, idx) => {
    detailSheet.getColumn(idx + 1).width = col.width;
  });

  /* ==========================================================================
     2. SHEET 2: 자재분류별_집계표 (Category Summary Sheet)
     ========================================================================== */
  const categorySheet = workbook.addWorksheet('자재분류별_집계표', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
  });

  // Title
  categorySheet.mergeCells('A1:G1');
  const catTitle = categorySheet.getCell('A1');
  catTitle.value = `자재 분류별 집계 현황 [ ${projectName} ]`;
  catTitle.font = { name: '맑은 고딕', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } }; // Indigo 900
  catTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  categorySheet.getRow(1).height = 34;

  // Subtitle
  categorySheet.mergeCells('A2:G2');
  const catSub = categorySheet.getCell('A2');
  catSub.value = `집계 기준: 공정분리 순수 재료비 기준  |  출력일자: ${dateString}`;
  catSub.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
  catSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  catSub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  categorySheet.getRow(2).height = 20;

  // Headers
  const catHeaders = [
    { header: '순번', width: 8 },
    { header: '자재 분류명', width: 22 },
    { header: '품목 수', width: 14 },
    { header: '재료비 합계 (자재비)', width: 22 },
    { header: '노무비 합계', width: 20 },
    { header: '총합계 금액', width: 22 },
    { header: '재료비 점유율 (%)', width: 18 }
  ];

  const catHeaderRow = categorySheet.getRow(3);
  catHeaderRow.values = catHeaders.map(h => h.header);
  catHeaderRow.height = 26;
  catHeaderRow.eachCell(cell => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo 700
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorder;
  });

  // Calculate category aggregates
  const categoryMap = new Map<string, { count: number; materialAmount: number; laborAmount: number; totalAmount: number }>();
  
  items.forEach(item => {
    const cat = item.category || '미분류';
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { count: 0, materialAmount: 0, laborAmount: 0, totalAmount: 0 });
    }
    const current = categoryMap.get(cat)!;
    current.count += 1;
    
    const mAmount = getItemMaterialCost(item);
    const lAmount = getItemLaborCost(item);
    const totAmount = getItemContractAmount(item);

    current.materialAmount += mAmount;
    current.laborAmount += lAmount;
    current.totalAmount += totAmount;
  });

  // Sort categories by material amount descending (excluding '미분류' placed at bottom)
  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => {
    if (a[0] === '미분류') return 1;
    if (b[0] === '미분류') return -1;
    return b[1].materialAmount - a[1].materialAmount;
  });

  let catRowIdx = 4;
  sortedCategories.forEach(([catName, stats], idx) => {
    const row = categorySheet.getRow(catRowIdx);
    const share = totalMaterialAmount > 0 ? stats.materialAmount / totalMaterialAmount : 0;

    row.values = [
      idx + 1,
      catName,
      stats.count,
      stats.materialAmount,
      stats.laborAmount,
      stats.totalAmount,
      share
    ];

    row.height = 22;
    const isEven = idx % 2 === 1;
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: '맑은 고딕', size: 9.5 };
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };

      switch (colNumber) {
        case 1:
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          break;
        case 2:
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: catName === '미분류' ? 'FFB45309' : 'FF312E81' } };
          if (catName === '미분류') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }
          break;
        case 3:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          break;
        case 4:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          break;
        case 5:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          break;
        case 6:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F766E' } };
          break;
        case 7:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '0.0%';
          cell.font = { name: '맑은 고딕', size: 9.5, bold: true };
          break;
      }
    });

    catRowIdx++;
  });

  // Category Total Row
  const catTotalRow = categorySheet.getRow(catRowIdx);
  catTotalRow.height = 28;
  categorySheet.mergeCells(`A${catRowIdx}:B${catRowIdx}`);
  const catTotalLabel = categorySheet.getCell(`A${catRowIdx}`);
  catTotalLabel.value = '자재분류 총계 (TOTAL)';
  catTotalLabel.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  catTotalLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  catTotalRow.getCell(3).value = { formula: `SUM(C4:C${catRowIdx - 1})` };
  catTotalRow.getCell(3).numFmt = '#,##0';

  catTotalRow.getCell(4).value = { formula: `SUM(D4:D${catRowIdx - 1})` };
  catTotalRow.getCell(4).numFmt = '#,##0';

  catTotalRow.getCell(5).value = { formula: `SUM(E4:E${catRowIdx - 1})` };
  catTotalRow.getCell(5).numFmt = '#,##0';

  catTotalRow.getCell(6).value = { formula: `SUM(F4:F${catRowIdx - 1})` };
  catTotalRow.getCell(6).numFmt = '#,##0';

  catTotalRow.getCell(7).value = 1.0;
  catTotalRow.getCell(7).numFmt = '100.0%';

  catTotalRow.eachCell((cell, colNumber) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
    cell.border = totalBorder;
    if (colNumber === 4) cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
    if (colNumber === 6) cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF0F766E' } };
  });

  catHeaders.forEach((col, idx) => {
    categorySheet.getColumn(idx + 1).width = col.width;
  });

  /* ==========================================================================
     3. SHEET 3: 공종별_집계표 (Section Summary Sheet)
     ========================================================================== */
  const sectionSheet = workbook.addWorksheet('공종별_집계표', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
  });

  // Title
  sectionSheet.mergeCells('A1:G1');
  const secTitle = sectionSheet.getCell('A1');
  secTitle.value = `공종별 내역 집계 현황 [ ${projectName} ]`;
  secTitle.font = { name: '맑은 고딕', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  secTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // Emerald 800
  secTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  sectionSheet.getRow(1).height = 34;

  // Subtitle
  sectionSheet.mergeCells('A2:G2');
  const secSub = sectionSheet.getCell('A2');
  secSub.value = `집계 기준: 내역서 대공종 구분  |  출력일자: ${dateString}`;
  secSub.font = { name: '맑은 고딕', size: 9, color: { argb: 'FF475569' } };
  secSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  secSub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  sectionSheet.getRow(2).height = 20;

  // Headers
  const secHeaders = [
    { header: '순번', width: 8 },
    { header: '공종명', width: 28 },
    { header: '품목 수', width: 14 },
    { header: '재료비 합계', width: 22 },
    { header: '노무비 합계', width: 20 },
    { header: '총합계 금액', width: 22 },
    { header: '금액 점유율 (%)', width: 18 }
  ];

  const secHeaderRow = sectionSheet.getRow(3);
  secHeaderRow.values = secHeaders.map(h => h.header);
  secHeaderRow.height = 26;
  secHeaderRow.eachCell(cell => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Emerald 700
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorder;
  });

  // Calculate Section aggregates
  const sectionMap = new Map<string, { count: number; materialAmount: number; laborAmount: number; totalAmount: number }>();
  
  items.forEach(item => {
    const sec = item.section || '기타 공정';
    if (!sectionMap.has(sec)) {
      sectionMap.set(sec, { count: 0, materialAmount: 0, laborAmount: 0, totalAmount: 0 });
    }
    const current = sectionMap.get(sec)!;
    current.count += 1;
    
    const mAmount = getItemMaterialCost(item);
    const lAmount = getItemLaborCost(item);
    const totAmount = getItemContractAmount(item);

    current.materialAmount += mAmount;
    current.laborAmount += lAmount;
    current.totalAmount += totAmount;
  });

  const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount);

  let secRowIdx = 4;
  sortedSections.forEach(([secName, stats], idx) => {
    const row = sectionSheet.getRow(secRowIdx);
    const share = totalGrandAmount > 0 ? stats.totalAmount / totalGrandAmount : 0;

    row.values = [
      idx + 1,
      secName,
      stats.count,
      stats.materialAmount,
      stats.laborAmount,
      stats.totalAmount,
      share
    ];

    row.height = 22;
    const isEven = idx % 2 === 1;
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: '맑은 고딕', size: 9.5 };
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };

      switch (colNumber) {
        case 1:
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          break;
        case 2:
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF065F46' } };
          break;
        case 3:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          break;
        case 4:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: '맑은 고딕', size: 9.5, color: { argb: 'FF1E40AF' } };
          break;
        case 5:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          break;
        case 6:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF0F766E' } };
          break;
        case 7:
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '0.0%';
          cell.font = { name: '맑은 고딕', size: 9.5, bold: true };
          break;
      }
    });

    secRowIdx++;
  });

  // Section Total Row
  const secTotalRow = sectionSheet.getRow(secRowIdx);
  secTotalRow.height = 28;
  sectionSheet.mergeCells(`A${secRowIdx}:B${secRowIdx}`);
  const secTotalLabel = sectionSheet.getCell(`A${secRowIdx}`);
  secTotalLabel.value = '공종별 총계 (TOTAL)';
  secTotalLabel.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  secTotalLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  secTotalRow.getCell(3).value = { formula: `SUM(C4:C${secRowIdx - 1})` };
  secTotalRow.getCell(3).numFmt = '#,##0';

  secTotalRow.getCell(4).value = { formula: `SUM(D4:D${secRowIdx - 1})` };
  secTotalRow.getCell(4).numFmt = '#,##0';

  secTotalRow.getCell(5).value = { formula: `SUM(E4:E${secRowIdx - 1})` };
  secTotalRow.getCell(5).numFmt = '#,##0';

  secTotalRow.getCell(6).value = { formula: `SUM(F4:F${secRowIdx - 1})` };
  secTotalRow.getCell(6).numFmt = '#,##0';

  secTotalRow.getCell(7).value = 1.0;
  secTotalRow.getCell(7).numFmt = '100.0%';

  secTotalRow.eachCell((cell, colNumber) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // Light Emerald
    cell.border = totalBorder;
    if (colNumber === 4) cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
    if (colNumber === 6) cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF0F766E' } };
  });

  secHeaders.forEach((col, idx) => {
    sectionSheet.getColumn(idx + 1).width = col.width;
  });

  /* ==========================================================================
     4. SHEET 4: 카테고리_구간별_집계표 (Category Matrix Breakdown Sheet - Construction Standard)
     ========================================================================== */
  const matrixSheet = workbook.addWorksheet('카테고리_구간별_집계표', {
    views: [{ state: 'frozen', xSplit: hidePriceAndAmount ? 4 : 6, ySplit: 2 }]
  });

  // 1. Extract all unique sections with positive total quantity
  const matrixSectionQtyMap = new Map<string, number>();
  items.forEach(item => {
    const sec = (item.section || '기타 공정').trim();
    const qty = item.quantity || 0;
    if (sec) {
      matrixSectionQtyMap.set(sec, (matrixSectionQtyMap.get(sec) || 0) + qty);
    }
  });

  const matrixSections: string[] = [];
  Array.from(matrixSectionQtyMap.entries()).forEach(([sec, totalQty]) => {
    if (totalQty > 0) {
      matrixSections.push(sec);
    }
  });

  if (matrixSections.length === 0) {
    matrixSections.push('기타 공정');
  }

  // 2. Setup Headers
  matrixSheet.getRow(1).height = 24;
  matrixSheet.getRow(2).height = 24;

  // Merge fixed columns vertically (A1:A2, B1:B2, C1:C2)
  matrixSheet.mergeCells('A1:A2');
  const mColA = matrixSheet.getCell('A1');
  mColA.value = '품 명';

  matrixSheet.mergeCells('B1:B2');
  const mColB = matrixSheet.getCell('B1');
  mColB.value = '규 격';

  matrixSheet.mergeCells('C1:C2');
  const mColC = matrixSheet.getCell('C1');
  mColC.value = '단위';

  if (hidePriceAndAmount) {
    // Single column for 수량(M)
    matrixSheet.mergeCells('D1:D2');
    const mColD = matrixSheet.getCell('D1');
    mColD.value = '수량(M)';
  } else {
    // Merge 내역물량 header horizontally (D1:F1)
    matrixSheet.mergeCells('D1:F1');
    const mColBoQ = matrixSheet.getCell('D1');
    mColBoQ.value = '내역물량';

    matrixSheet.getCell('D2').value = '수량(M)';
    matrixSheet.getCell('E2').value = '단가';
    matrixSheet.getCell('F2').value = '금액';
  }

  const sectionStartCol = hidePriceAndAmount ? 5 : 7;
  const totalBaseCols = hidePriceAndAmount ? 4 : 6;

  // Section Headers
  matrixSections.forEach((sec, idx) => {
    const colNum = sectionStartCol + idx;
    let mainGroup = '기계설비';
    let subGroup = sec;

    const parsed = extractProcessCode(sec);
    if (parsed) {
      const { code, rest } = parsed;
      subGroup = rest || sec;
      if (code.length === 10) {
        const l2Code = code.slice(0, 8);
        mainGroup = LEVEL_2_PROCESS_NAMES[l2Code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
        if (mainGroup && subGroup.includes(mainGroup)) {
          const stripped = subGroup.replace(mainGroup, '').trim();
          if (stripped) {
            subGroup = stripped;
          }
        }
      } else if (code.length === 8) {
        mainGroup = LEVEL_2_PROCESS_NAMES[code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
        if (mainGroup && subGroup.includes(mainGroup)) {
          const stripped = subGroup.replace(mainGroup, '').trim();
          subGroup = stripped || LEVEL_2_PROCESS_NAMES[code]?.name || mainGroup;
        }
      } else if (code.length === 6) {
        mainGroup = LEVEL_1_PROCESS_NAMES[code] || '기계설비';
        subGroup = mainGroup;
      }
    } else if (sec.includes('>')) {
      const parts = sec.split('>');
      mainGroup = parts[0].trim();
      subGroup = parts.slice(1).join('>').trim();
    } else if (/^\d+/.test(sec)) {
      subGroup = sec.replace(/^\d+[\s._-]*/, '').trim() || sec;
    }

    const dynHeader = matrixHeaderFor(sec, headerLookup);
    if (dynHeader) { mainGroup = dynHeader.mainGroup; subGroup = dynHeader.subGroup; }

    const cellTop = matrixSheet.getRow(1).getCell(colNum);
    cellTop.value = mainGroup;

    const cellBottom = matrixSheet.getRow(2).getCell(colNum);
    cellBottom.value = subGroup;
  });

  // Style Header Cells
  const headerFillGray: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  const headerFillBoQ: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } };

  [1, 2].forEach(rIdx => {
    const row = matrixSheet.getRow(rIdx);
    row.eachCell({ includeEmpty: true }, (cell, cIdx) => {
      cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = headerBorder;
      if (hidePriceAndAmount) {
        cell.fill = cIdx === 4 ? headerFillBoQ : headerFillGray;
      } else {
        cell.fill = cIdx >= 4 && cIdx <= 6 ? headerFillBoQ : headerFillGray;
      }
    });
  });

  // 3. Aggregate Data by Category -> Item
  interface ExportMatrixItem {
    name: string;
    spec: string;
    unit: string;
    unitPrice: number;
    totalQty: number;
    totalAmount: number;
    sectionQty: Record<string, number>;
  }

  const exportCategoryMap = new Map<string, Map<string, ExportMatrixItem>>();
  
  items.forEach(item => {
    const itemCat = (item.category || '미분류').trim() || '미분류';
    const name = (item.name || '').trim();
    const spec = (item.specification || '').trim();
    const unit = (item.unit || 'EA').trim() || 'EA';
    const sec = (item.section || '기타 공정').trim() || '기타 공정';
    const qty = item.quantity || 0;
    
    const matAmt = getItemMaterialCost(item);
    const labAmt = getItemLaborCost(item);
    
    const isSpecial = isIndirectCostCategory(itemCat) || isClientSuppliedCategory(itemCat);

    if (isSpecial) {
      // Everything stays in the special category
      const cat = itemCat;
      const unitPrice = item.unitPrice || (qty > 0 ? (matAmt + labAmt) / qty : 0);
      const amt = matAmt + labAmt;
      
      if (!exportCategoryMap.has(cat)) exportCategoryMap.set(cat, new Map());
      const itemMap = exportCategoryMap.get(cat)!;
      const key = `${name}:::${spec}:::${unit}:::${unitPrice}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { name, spec, unit, unitPrice, totalQty: 0, totalAmount: 0, sectionQty: {} });
      }
      const rowObj = itemMap.get(key)!;
      rowObj.totalQty += qty;
      rowObj.totalAmount += amt;
      rowObj.sectionQty[sec] = (rowObj.sectionQty[sec] || 0) + qty;
    } else {
      // Keep both in original category, but separate rows
      // 품목 1행 (노무비만 있는 품목도 수량은 표시)
      {
        const cat = itemCat;
        const unitPrice = item.materialUnitPrice || (qty > 0 ? matAmt / qty : 0);
        const amt = matAmt;
        
        if (!exportCategoryMap.has(cat)) exportCategoryMap.set(cat, new Map());
        const itemMap = exportCategoryMap.get(cat)!;
        const key = `${name}:::${spec}:::${unit}:::${unitPrice}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, { name, spec, unit, unitPrice, totalQty: 0, totalAmount: 0, sectionQty: {} });
        }
        const rowObj = itemMap.get(key)!;
        rowObj.totalQty += qty;
        rowObj.totalAmount += amt;
        rowObj.sectionQty[sec] = (rowObj.sectionQty[sec] || 0) + qty;
      }
      
      // [노무비] 별도 행은 만들지 않음 (집계표에는 품목별 1행만 표시)
    }
  });

  // 4. Populate Matrix Rows
  let matrixRowIdx = 3;
  const goldenSubtotalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4C287' } };
  const grandTotalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } };

  const orderedCategories = [
    ...categories.filter(c => exportCategoryMap.has(c)),
    ...Array.from(exportCategoryMap.keys()).filter(c => !categories.includes(c))
  ];

  let allGrandTotalQty = 0;
  let allGrandTotalAmt = 0;
  const allGrandSectionQty: Record<string, number> = {};

  orderedCategories.forEach(cat => {
    const itemMap = exportCategoryMap.get(cat);
    if (!itemMap || itemMap.size === 0) return;

    const validItems = Array.from(itemMap.values()).filter(item => item.totalQty > 0);
    if (validItems.length === 0) return;

    let catSubtotalQty = 0;
    let catSubtotalAmt = 0;
    const catSectionSubtotals: Record<string, number> = {};

    validItems.forEach(item => {
      catSubtotalQty += item.totalQty;
      catSubtotalAmt += item.totalAmount;
      allGrandTotalQty += item.totalQty;
      allGrandTotalAmt += item.totalAmount;

      const row = matrixSheet.getRow(matrixRowIdx);
      row.height = 20;

      // Col A: Name
      row.getCell(1).value = item.name;
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(1).font = { name: '맑은 고딕', size: 9 };

      // Col B: Spec
      row.getCell(2).value = item.spec;
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).font = { name: '맑은 고딕', size: 9 };

      // Col C: Unit
      row.getCell(3).value = item.unit;
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).font = { name: '맑은 고딕', size: 9 };

      // Col D: Total Qty
      row.getCell(4).value = item.totalQty;
      row.getCell(4).numFmt = '#,##0';
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).font = { name: '맑은 고딕', size: 9, bold: true };

      if (!hidePriceAndAmount) {
        // Col E: Unit Price
        row.getCell(5).value = item.unitPrice;
        row.getCell(5).numFmt = '#,##0';
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(5).font = { name: '맑은 고딕', size: 9 };

        // Col F: Total Amount
        row.getCell(6).value = item.totalAmount;
        row.getCell(6).numFmt = '#,##0';
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).font = { name: '맑은 고딕', size: 9, bold: true };
      }

      // Section columns
      matrixSections.forEach((sec, sIdx) => {
        const cNum = sectionStartCol + sIdx;
        const q = item.sectionQty[sec] || 0;
        catSectionSubtotals[sec] = (catSectionSubtotals[sec] || 0) + q;
        allGrandSectionQty[sec] = (allGrandSectionQty[sec] || 0) + q;

        const cell = row.getCell(cNum);
        if (q > 0) {
          cell.value = q;
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: '맑은 고딕', size: 9, bold: true };
        } else {
          cell.value = '';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      // Apply thin borders to all columns in data row
      for (let c = 1; c <= totalBaseCols + matrixSections.length; c++) {
        row.getCell(c).border = thinBorder;
      }

      matrixRowIdx++;
    });

    // Category Subtotal Row (소계)
    const subRow = matrixSheet.getRow(matrixRowIdx);
    subRow.height = 22;

    subRow.getCell(1).value = cat;
    subRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    subRow.getCell(1).font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

    subRow.getCell(2).value = 'EA';
    subRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    subRow.getCell(2).font = { name: '맑은 고딕', size: 9.5, bold: true };

    subRow.getCell(3).value = '소계';
    subRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    subRow.getCell(3).font = { name: '맑은 고딕', size: 9.5, bold: true };

    subRow.getCell(4).value = catSubtotalQty;
    subRow.getCell(4).numFmt = '#,##0';
    subRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    subRow.getCell(4).font = { name: '맑은 고딕', size: 9.5, bold: true };

    if (!hidePriceAndAmount) {
      subRow.getCell(5).value = '-';
      subRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      subRow.getCell(6).value = catSubtotalAmt;
      subRow.getCell(6).numFmt = '#,##0';
      subRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      subRow.getCell(6).font = { name: '맑은 고딕', size: 9.5, bold: true };
    }

    matrixSections.forEach((sec, sIdx) => {
      const cNum = sectionStartCol + sIdx;
      const secQ = catSectionSubtotals[sec] || 0;
      const cell = subRow.getCell(cNum);
      if (secQ > 0) {
        cell.value = secQ;
        cell.numFmt = '#,##0';
      } else {
        cell.value = '';
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: '맑은 고딕', size: 9.5, bold: true };
    });

    for (let c = 1; c <= totalBaseCols + matrixSections.length; c++) {
      const cell = subRow.getCell(c);
      cell.fill = goldenSubtotalFill;
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    }

    matrixRowIdx++;
  });

  // Grand Total Row (합 계)
  const grandRow = matrixSheet.getRow(matrixRowIdx);
  grandRow.height = 26;

  matrixSheet.mergeCells(`A${matrixRowIdx}:C${matrixRowIdx}`);
  const grandLabel = matrixSheet.getCell(`A${matrixRowIdx}`);
  grandLabel.value = '합  계';
  grandLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  grandLabel.font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };

  grandRow.getCell(4).value = allGrandTotalQty;
  grandRow.getCell(4).numFmt = '#,##0';
  grandRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  grandRow.getCell(4).font = { name: '맑은 고딕', size: 10, bold: true };

  if (!hidePriceAndAmount) {
    grandRow.getCell(5).value = '-';
    grandRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

    grandRow.getCell(6).value = allGrandTotalAmt;
    grandRow.getCell(6).numFmt = '#,##0';
    grandRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    grandRow.getCell(6).font = { name: '맑은 고딕', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
  }

  matrixSections.forEach((sec, sIdx) => {
    const cNum = sectionStartCol + sIdx;
    const gQ = allGrandSectionQty[sec] || 0;
    const cell = grandRow.getCell(cNum);
    if (gQ > 0) {
      cell.value = gQ;
      cell.numFmt = '#,##0';
    } else {
      cell.value = '-';
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.font = { name: '맑은 고딕', size: 10, bold: true };
  });

  for (let c = 1; c <= totalBaseCols + matrixSections.length; c++) {
    const cell = grandRow.getCell(c);
    cell.fill = grandTotalFill;
    cell.border = totalBorder;
  }

  // Column Widths for Matrix Sheet
  matrixSheet.getColumn(1).width = 28; // 품명
  matrixSheet.getColumn(2).width = 16; // 규격
  matrixSheet.getColumn(3).width = 8;  // 단위
  matrixSheet.getColumn(4).width = 12; // 수량
  if (!hidePriceAndAmount) {
    matrixSheet.getColumn(5).width = 14; // 단가
    matrixSheet.getColumn(6).width = 16; // 금액
  }
  matrixSections.forEach((sec, idx) => {
    const colNum = sectionStartCol + idx;
    const col = matrixSheet.getColumn(colNum);
    col.width = 13;
    const gQ = allGrandSectionQty[sec] || 0;
    if (autoHideEmptySectionCols && gQ <= 0) {
      col.hidden = true;
    }
  });

  /* ==========================================================================
     5. SHEET 5+: 카테고리별 공정분리 시트 (카테고리_구간별_집계표 양식 적용)
     백강관, 강관부속, STS위생관 등 카테고리별로 구간별 집계표 양식의 전용 시트 분리 생성
     ========================================================================== */
  function getColumnLetter(colIndex: number): string {
    let temp = colIndex;
    let letter = '';
    while (temp > 0) {
      const rem = (temp - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  }

  // Track existing sheet names to avoid collision and invalid characters in Excel
  const existingSheetNames = new Set<string>([
    '공정분리_내역서',
    '자재분류별_집계표',
    '공종별_집계표',
    '카테고리_구간별_집계표'
  ]);

  const sanitizeSheetName = (name: string): string => {
    let clean = name.replace(/[/\\?*:[\]]/g, '_').trim();
    if (!clean) clean = '기타';
    clean = clean.slice(0, 31);
    let finalName = clean;
    let counter = 1;
    while (existingSheetNames.has(finalName)) {
      const suffix = `_${counter}`;
      finalName = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
      counter++;
    }
    existingSheetNames.add(finalName);
    return finalName;
  };

  // Determine sorted category list:
  // General Materials (백강관, 강관부속, STS위생관...) -> Safety Equipment -> Outsourcing -> Unclassified
  const presentCategories = Array.from(exportCategoryMap.keys());
  const initialOrderedList: string[] = [];

  categories.forEach(c => {
    const trimmed = c.trim();
    if (exportCategoryMap.has(trimmed) && !initialOrderedList.includes(trimmed)) {
      initialOrderedList.push(trimmed);
    }
  });

  presentCategories.forEach(c => {
    if (!initialOrderedList.includes(c)) {
      initialOrderedList.push(c);
    }
  });

  const generalCats: string[] = [];
  const safetyCats: string[] = [];
  const outsourcingCats: string[] = [];
  const unclassifiedCats: string[] = [];

  initialOrderedList.forEach(cat => {
    if (cat === '미분류') {
      unclassifiedCats.push(cat);
    } else if (isOutsourcingCategory(cat) || isIndirectCostCategory(cat) || isClientSuppliedCategory(cat)) {
      outsourcingCats.push(cat);
    } else if (cat.includes('안전')) {
      safetyCats.push(cat);
    } else {
      generalCats.push(cat);
    }
  });

  const finalCategorySheetOrder = [
    ...generalCats,
    ...safetyCats,
    ...outsourcingCats,
    ...unclassifiedCats
  ];

  finalCategorySheetOrder.forEach(catName => {
    const itemMap = exportCategoryMap.get(catName);
    if (!itemMap || itemMap.size === 0) return;

    const validItems = Array.from(itemMap.values()).filter(item => item.totalQty > 0);
    if (validItems.length === 0) return;

    const sheetName = sanitizeSheetName(catName);
    const catSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: hidePriceAndAmount ? 4 : 6, ySplit: 2 }]
    });

    // 1. Setup Two-level Matrix Headers (identical to 카테고리_구간별_집계표)
    catSheet.getRow(1).height = 24;
    catSheet.getRow(2).height = 24;

    catSheet.mergeCells('A1:A2');
    catSheet.getCell('A1').value = '품 명';

    catSheet.mergeCells('B1:B2');
    catSheet.getCell('B1').value = '규 격';

    catSheet.mergeCells('C1:C2');
    catSheet.getCell('C1').value = '단위';

    if (hidePriceAndAmount) {
      catSheet.mergeCells('D1:D2');
      catSheet.getCell('D1').value = '수량(M)';
    } else {
      catSheet.mergeCells('D1:F1');
      catSheet.getCell('D1').value = '내역물량';
      catSheet.getCell('D2').value = '수량(M)';
      catSheet.getCell('E2').value = '단가';
      catSheet.getCell('F2').value = '금액';
    }

    // Section Headers
    matrixSections.forEach((sec, idx) => {
      const colNum = sectionStartCol + idx;
      let mainGroup = '기계설비';
      let subGroup = sec;

      const parsed = extractProcessCode(sec);
      if (parsed) {
        const { code, rest } = parsed;
        subGroup = rest || sec;
        if (code.length === 10) {
          const l2Code = code.slice(0, 8);
          mainGroup = LEVEL_2_PROCESS_NAMES[l2Code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
          if (mainGroup && subGroup.includes(mainGroup)) {
            const stripped = subGroup.replace(mainGroup, '').trim();
            if (stripped) {
              subGroup = stripped;
            }
          }
        } else if (code.length === 8) {
          mainGroup = LEVEL_2_PROCESS_NAMES[code]?.combined || LEVEL_1_PROCESS_NAMES[code.slice(0, 6)] || '기계설비';
          if (mainGroup && subGroup.includes(mainGroup)) {
            const stripped = subGroup.replace(mainGroup, '').trim();
            subGroup = stripped || LEVEL_2_PROCESS_NAMES[code]?.name || mainGroup;
          }
        } else if (code.length === 6) {
          mainGroup = LEVEL_1_PROCESS_NAMES[code] || '기계설비';
          subGroup = mainGroup;
        }
      } else if (sec.includes('>')) {
        const parts = sec.split('>');
        mainGroup = parts[0].trim();
        subGroup = parts.slice(1).join('>').trim();
      } else if (/^\d+/.test(sec)) {
        subGroup = sec.replace(/^\d+[\s._-]*/, '').trim() || sec;
      }

      const dynHeader = matrixHeaderFor(sec, headerLookup);
      if (dynHeader) { mainGroup = dynHeader.mainGroup; subGroup = dynHeader.subGroup; }

      const cellTop = catSheet.getRow(1).getCell(colNum);
      cellTop.value = mainGroup;

      const cellBottom = catSheet.getRow(2).getCell(colNum);
      cellBottom.value = subGroup;
    });

    // Style Header Cells
    [1, 2].forEach(rIdx => {
      const row = catSheet.getRow(rIdx);
      row.eachCell({ includeEmpty: true }, (cell, cIdx) => {
        cell.font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = headerBorder;
        if (hidePriceAndAmount) {
          cell.fill = cIdx === 4 ? headerFillBoQ : headerFillGray;
        } else {
          cell.fill = cIdx >= 4 && cIdx <= 6 ? headerFillBoQ : headerFillGray;
        }
      });
    });

    // 2. Populate Category Item Rows
    let catRowIdx = 3;
    let catSubtotalQty = 0;
    let catSubtotalAmt = 0;
    const catSectionSubtotals: Record<string, number> = {};

    validItems.forEach((item, itemIdx) => {
      catSubtotalQty += item.totalQty;
      catSubtotalAmt += item.totalAmount;

      const row = catSheet.getRow(catRowIdx);
      row.height = 20;

      // Col A: Name
      row.getCell(1).value = item.name;
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(1).font = { name: '맑은 고딕', size: 9 };

      // Col B: Spec
      row.getCell(2).value = item.spec;
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).font = { name: '맑은 고딕', size: 9 };

      // Col C: Unit
      row.getCell(3).value = item.unit;
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).font = { name: '맑은 고딕', size: 9 };

      // Col D: Total Qty
      row.getCell(4).value = item.totalQty;
      row.getCell(4).numFmt = Number.isInteger(item.totalQty) ? '#,##0' : '#,##0.00';
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).font = { name: '맑은 고딕', size: 9, bold: true };

      if (!hidePriceAndAmount) {
        // Col E: Unit Price
        row.getCell(5).value = item.unitPrice;
        row.getCell(5).numFmt = '#,##0';
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(5).font = { name: '맑은 고딕', size: 9 };

        // Col F: Total Amount
        row.getCell(6).value = item.totalAmount;
        row.getCell(6).numFmt = '#,##0';
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).font = { name: '맑은 고딕', size: 9, bold: true };
      }

      // Section columns
      matrixSections.forEach((sec, sIdx) => {
        const cNum = sectionStartCol + sIdx;
        const q = item.sectionQty[sec] || 0;
        catSectionSubtotals[sec] = (catSectionSubtotals[sec] || 0) + q;

        const cell = row.getCell(cNum);
        if (q > 0) {
          cell.value = q;
          cell.numFmt = Number.isInteger(q) ? '#,##0' : '#,##0.00';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: '맑은 고딕', size: 9, bold: true };
        } else {
          cell.value = '';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      const isEven = itemIdx % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
      for (let c = 1; c <= totalBaseCols + matrixSections.length; c++) {
        const cell = row.getCell(c);
        cell.border = thinBorder;
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      }

      catRowIdx++;
    });

    // 3. Category Subtotal Row (소계 / TOTAL)
    const lastDataRow = catRowIdx - 1;
    const subRow = catSheet.getRow(catRowIdx);
    subRow.height = 24;

    subRow.getCell(1).value = `[ ${catName} ] 소계 (TOTAL)`;
    subRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    subRow.getCell(1).font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

    subRow.getCell(2).value = 'EA';
    subRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    subRow.getCell(2).font = { name: '맑은 고딕', size: 9.5, bold: true };

    subRow.getCell(3).value = '소계';
    subRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    subRow.getCell(3).font = { name: '맑은 고딕', size: 9.5, bold: true };

    subRow.getCell(4).value = {
      formula: `SUM(D3:D${lastDataRow})`,
      result: catSubtotalQty
    };
    subRow.getCell(4).numFmt = Number.isInteger(catSubtotalQty) ? '#,##0' : '#,##0.00';
    subRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    subRow.getCell(4).font = { name: '맑은 고딕', size: 9.5, bold: true };

    if (!hidePriceAndAmount) {
      subRow.getCell(5).value = '-';
      subRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      subRow.getCell(6).value = {
        formula: `SUM(F3:F${lastDataRow})`,
        result: catSubtotalAmt
      };
      subRow.getCell(6).numFmt = '#,##0';
      subRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      subRow.getCell(6).font = { name: '맑은 고딕', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
    }

    matrixSections.forEach((sec, sIdx) => {
      const cNum = sectionStartCol + sIdx;
      const colLetter = getColumnLetter(cNum);
      const secQ = catSectionSubtotals[sec] || 0;
      const cell = subRow.getCell(cNum);
      if (secQ > 0) {
        cell.value = {
          formula: `SUM(${colLetter}3:${colLetter}${lastDataRow})`,
          result: secQ
        };
        cell.numFmt = Number.isInteger(secQ) ? '#,##0' : '#,##0.00';
      } else {
        cell.value = '';
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: '맑은 고딕', size: 9.5, bold: true };
    });

    for (let c = 1; c <= totalBaseCols + matrixSections.length; c++) {
      const cell = subRow.getCell(c);
      cell.fill = goldenSubtotalFill;
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    }

    // 4. Column Widths for Category Matrix Sheet
    catSheet.getColumn(1).width = 28; // 품명
    catSheet.getColumn(2).width = 16; // 규격
    catSheet.getColumn(3).width = 8;  // 단위
    catSheet.getColumn(4).width = 12; // 수량
    if (!hidePriceAndAmount) {
      catSheet.getColumn(5).width = 14; // 단가
      catSheet.getColumn(6).width = 16; // 금액
    }
    matrixSections.forEach((sec, idx) => {
      const colNum = sectionStartCol + idx;
      const col = catSheet.getColumn(colNum);
      col.width = 13;
      const secTotal = catSectionSubtotals[sec] || 0;
      if (autoHideEmptySectionCols && secTotal <= 0) {
        col.hidden = true;
      }
    });
  });

  /* ==========================================================================
     6. Write and Trigger Browser Download
     ========================================================================== */
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanProjectName = (projectName || '기계설비').replace(/[/\\?%*:|"<>]/g, '_');
  const dateFormatted = new Date().toISOString().slice(0, 10);
  link.download = `공정분리_내역결과_${cleanProjectName}_${dateFormatted}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
