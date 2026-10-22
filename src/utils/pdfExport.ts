import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PDFExportOptions {
  element: HTMLElement;
  filename?: string;
  projectName?: string;
  categoryCount?: number;
  itemCount?: number;
  totalQty?: number;
  totalAmt?: number;
  hidePriceAndAmount?: boolean;
  onProgress?: (status: string) => void;
}

/**
 * Exports the Matrix table as a high-quality, multi-page landscape PDF report.
 */
export async function exportMatrixToPDF({
  element,
  filename = '카테고리별_공정_구간별_집계표_보고서',
  projectName = '기계설비 공정분리 현장',
  categoryCount = 0,
  itemCount = 0,
  totalQty = 0,
  totalAmt = 0,
  hidePriceAndAmount = false,
  onProgress
}: PDFExportOptions): Promise<void> {
  try {
    if (onProgress) onProgress('보고서 레이아웃 및 서식 준비 중...');

    // Find the inner table or container to capture
    const targetTable = element.querySelector('table') || element;
    const tableWidth = Math.max(targetTable.scrollWidth, element.scrollWidth, 1200);

    // Create an offscreen cloned container with full width to guarantee no horizontal cropping or scrollbar artifacts
    const cloneWrapper = document.createElement('div');
    cloneWrapper.style.position = 'absolute';
    cloneWrapper.style.left = '-9999px';
    cloneWrapper.style.top = '0';
    cloneWrapper.style.width = `${tableWidth + 40}px`;
    cloneWrapper.style.backgroundColor = '#ffffff';
    cloneWrapper.style.padding = '20px';
    cloneWrapper.style.fontFamily = '"Gulim", "굴림", Dotum, "돋움", sans-serif';
    cloneWrapper.style.boxSizing = 'border-box';

    // Build Report Header inside clone
    const now = new Date();
    const formattedDate = `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const reportHeaderHtml = `
      <div style="margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; font-family: inherit;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
          <div>
            <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
              [ ${projectName} ] 카테고리별 공정·구간별 집계표 (Matrix 보고서)
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 4px; font-weight: bold;">
              도면 내역 표준 서식 (Category & Section Matrix Breakdown)
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div>출력 일시: <strong>${formattedDate}</strong></div>
            <div style="color: #0284c7; font-weight: bold; margin-top: 2px;">기계설비 공정분리 자동화 시스템</div>
          </div>
        </div>
        <div style="display: flex; gap: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 14px; font-size: 11.5px; color: #334155;">
          <div>집계 대상: <strong style="color: #0f172a;">${categoryCount}개 카테고리 / ${itemCount.toLocaleString()}개 규격</strong></div>
          <div style="color: #94a3b8;">|</div>
          <div>총 내역수량: <strong style="color: #4338ca;">${totalQty.toLocaleString()}</strong></div>
          ${
            !hidePriceAndAmount
              ? `<div style="color: #94a3b8;">|</div><div>총 공사비(금액): <strong style="color: #1e1b4b;">₩${totalAmt.toLocaleString()}</strong></div>`
              : `<div style="color: #94a3b8;">|</div><div style="color: #d97706; font-weight: bold;">[단가 및 금액 열 숨김 모드]</div>`
          }
        </div>
      </div>
    `;

    cloneWrapper.innerHTML = reportHeaderHtml;

    // Clone the table element
    const clonedTable = targetTable.cloneNode(true) as HTMLElement;
    clonedTable.style.width = '100%';
    clonedTable.style.maxWidth = 'none';
    clonedTable.style.tableLayout = 'fixed';
    
    // Remove sticky headers and interactive classes for clean static render
    const stickyThead = clonedTable.querySelector('thead');
    if (stickyThead) {
      stickyThead.style.position = 'static';
    }

    cloneWrapper.appendChild(clonedTable);
    document.body.appendChild(cloneWrapper);

    if (onProgress) onProgress('고해상도 이미지 렌더링 중...');

    // Render offscreen canvas with html2canvas
    const canvas = await html2canvas(cloneWrapper, {
      scale: 2, // 2x Retina resolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: cloneWrapper.offsetWidth,
      height: cloneWrapper.offsetHeight
    });

    // Cleanup cloned DOM
    document.body.removeChild(cloneWrapper);

    if (onProgress) onProgress('PDF 문서 생성 및 페이지 분할 중...');

    // Landscape A4 dimensions: 297mm x 210mm
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 8; // 8mm margins
    const footerHeight = 8; // 8mm footer area
    const usableWidth = pageWidth - margin * 2; // 281mm
    const usableHeight = pageHeight - margin * 2 - footerHeight; // 186mm

    // Calculate image dimensions scaled to fit usableWidth
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const totalPages = Math.max(1, Math.ceil(imgHeight / usableHeight));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage('a4', 'landscape');
      }

      // Slice image for current page
      const pageCanvas = document.createElement('canvas');
      const ctx = pageCanvas.getContext('2d');

      const sourceY = (page * usableHeight * canvas.width) / imgWidth;
      const sourceHeight = Math.min((usableHeight * canvas.width) / imgWidth, canvas.height - sourceY);

      if (sourceHeight > 0 && ctx) {
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/png');
        const renderedHeight = (sourceHeight * imgWidth) / canvas.width;

        pdf.addImage(
          pageImgData,
          'PNG',
          margin,
          margin,
          imgWidth,
          renderedHeight,
          undefined,
          'FAST'
        );
      }

      // Bottom Footer Line & Page Number
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, pageHeight - margin - 2, pageWidth - margin, pageHeight - margin - 2);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(
        `[ ${projectName} ] 카테고리별 공정·구간별 집계표 (Matrix 보고서)  |  도면 내역 표준 서식`,
        margin,
        pageHeight - margin + 2
      );
      pdf.text(
        `Page ${page + 1} / ${totalPages}`,
        pageWidth - margin,
        pageHeight - margin + 2,
        { align: 'right' }
      );
    }

    if (onProgress) onProgress('PDF 다운로드 시작...');

    // Trigger download
    const cleanFilename = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
    pdf.save(cleanFilename);
  } catch (error) {
    console.error('Failed to generate PDF report:', error);
    throw error;
  }
}
