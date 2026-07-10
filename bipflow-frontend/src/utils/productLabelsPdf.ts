import { jsPDF } from 'jspdf';
import type { ProductBulkLabel } from '@/types/productLabel';

/**
 * Etapa 6 of the QR-code stock-exit evolution: generates a single PDF with
 * a fixed grid of printable QR labels for a batch selection. Client-side,
 * same reasoning as utils/receiptPdf.ts for not adding a server-side PDF
 * library -- the label's content already lives in this same Vue app.
 *
 * Unlike receiptPdf.ts, this has no measure-then-draw pass: a receipt's
 * total height depends on its item count, but a label sheet is always a
 * fixed A4 page with fixed-size cells, so there's no unknown total height
 * to measure up front. A long product name is instead clamped to 2 lines
 * within its cell (doc.splitTextToSize(), same wrapping technique as
 * receiptPdf.ts) rather than letting the cell grow, since a taller cell
 * would desync the fixed grid alignment of its neighbors.
 */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const COLUMNS = 2;
const ROWS = 5;
const LABELS_PER_PAGE = COLUMNS * ROWS;

const CELL_WIDTH_MM = (PAGE_WIDTH_MM - MARGIN_MM * 2) / COLUMNS;
const CELL_HEIGHT_MM = (PAGE_HEIGHT_MM - MARGIN_MM * 2) / ROWS;
const CELL_PADDING_MM = 4;
const QR_SIZE_MM = 26;
const NAME_LINE_HEIGHT_MM = 3.2;
const DASH_BORDER_RGB: [number, number, number] = [209, 213, 219]; // #D1D5DB, same dashed border gray as .qr-printable-label on screen

function formatPriceBRL(price: string): string {
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice)) {
    return price;
  }
  return `R$ ${numericPrice.toFixed(2).replace('.', ',')}`;
}

function drawLabel(doc: jsPDF, label: ProductBulkLabel, cellX: number, cellY: number): void {
  const centerX = cellX + CELL_WIDTH_MM / 2;
  const contentWidth = CELL_WIDTH_MM - CELL_PADDING_MM * 2;

  doc.setDrawColor(...DASH_BORDER_RGB);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(cellX + 1, cellY + 1, CELL_WIDTH_MM - 2, CELL_HEIGHT_MM - 2);
  doc.setLineDashPattern([], 0);

  let y = cellY + CELL_PADDING_MM + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 5, 10); // #05050A
  const nameLines = (doc.splitTextToSize(label.name.toUpperCase(), contentWidth) as string[]).slice(0, 2);
  nameLines.forEach((line) => {
    doc.text(line, centerX, y, { align: 'center' });
    y += NAME_LINE_HEIGHT_MM;
  });

  y += 1;
  doc.addImage(label.qr_code, 'PNG', centerX - QR_SIZE_MM / 2, y, QR_SIZE_MM, QR_SIZE_MM);
  y += QR_SIZE_MM + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(216, 27, 96); // #D81B60
  const priceLine = label.size ? `${formatPriceBRL(label.price)}  •  ${label.size}` : formatPriceBRL(label.price);
  doc.text(priceLine, centerX, y, { align: 'center' });
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.text(label.public_code, centerX, y, { align: 'center' });
}

export function buildProductLabelsPdf(labels: ProductBulkLabel[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  labels.forEach((label, index) => {
    const positionOnPage = index % LABELS_PER_PAGE;
    if (index > 0 && positionOnPage === 0) {
      doc.addPage();
    }

    const column = positionOnPage % COLUMNS;
    const row = Math.floor(positionOnPage / COLUMNS);
    const cellX = MARGIN_MM + column * CELL_WIDTH_MM;
    const cellY = MARGIN_MM + row * CELL_HEIGHT_MM;

    drawLabel(doc, label, cellX, cellY);
  });

  return doc;
}
