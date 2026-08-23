import { jsPDF } from 'jspdf';
import {
  DEFAULT_PRODUCT_LABEL_SETTINGS,
  type ProductBulkLabel,
  type ProductLabelSettings,
} from '@/types/productLabel';

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
const NAME_LINE_HEIGHT_MM = 3.2;
const DASH_BORDER_RGB: [number, number, number] = [209, 213, 219]; // #D1D5DB, same dashed border gray as .qr-printable-label on screen

type ProductLabelLayout = ProductLabelSettings & {
  cellWidthMm: number;
  cellHeightMm: number;
};

function resolveLabelLayout(settings?: ProductLabelSettings): ProductLabelLayout {
  const resolved = settings ?? DEFAULT_PRODUCT_LABEL_SETTINGS;
  const cellWidthMm = (PAGE_WIDTH_MM - resolved.margin_mm * 2) / resolved.columns;
  const cellHeightMm = (PAGE_HEIGHT_MM - resolved.margin_mm * 2) / resolved.rows;

  return {
    ...resolved,
    cellWidthMm,
    cellHeightMm,
  };
}

function formatPriceBRL(price: string): string {
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice)) {
    return price;
  }
  return `R$ ${numericPrice.toFixed(2).replace('.', ',')}`;
}

function drawLabel(
  doc: jsPDF,
  label: ProductBulkLabel,
  cellX: number,
  cellY: number,
  layout: ProductLabelLayout
): void {
  const centerX = cellX + layout.cellWidthMm / 2;
  const contentWidth = layout.cellWidthMm - layout.cell_padding_mm * 2;

  doc.setDrawColor(...DASH_BORDER_RGB);
  doc.setLineDashPattern([1, 1], 0);
  doc.rect(cellX + 1, cellY + 1, layout.cellWidthMm - 2, layout.cellHeightMm - 2);
  doc.setLineDashPattern([], 0);

  let y = cellY + layout.cell_padding_mm + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 5, 10); // #05050A
  const nameLines = (doc.splitTextToSize(label.name.toUpperCase(), contentWidth) as string[]).slice(0, 2);
  nameLines.forEach((line) => {
    doc.text(line, centerX, y, { align: 'center' });
    y += NAME_LINE_HEIGHT_MM;
  });

  y += 1;
  doc.addImage(label.qr_code, 'PNG', centerX - layout.qr_size_mm / 2, y, layout.qr_size_mm, layout.qr_size_mm);
  y += layout.qr_size_mm + 3;

  const detailParts = [
    layout.show_price ? formatPriceBRL(label.price) : '',
    layout.show_size && label.size ? label.size : '',
  ].filter(Boolean);

  if (detailParts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(216, 27, 96); // #D81B60
    doc.text(detailParts.join(' - '), centerX, y, { align: 'center' });
    y += 4;
  }

  if (layout.show_public_code) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128); // #6B7280
    doc.text(label.public_code, centerX, y, { align: 'center' });
  }
}

export function buildProductLabelsPdf(
  labels: ProductBulkLabel[],
  settings?: ProductLabelSettings
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const layout = resolveLabelLayout(settings);
  const labelsPerPage = layout.columns * layout.rows;

  labels.forEach((label, index) => {
    const positionOnPage = index % labelsPerPage;
    if (index > 0 && positionOnPage === 0) {
      doc.addPage();
    }

    const column = positionOnPage % layout.columns;
    const row = Math.floor(positionOnPage / layout.columns);
    const cellX = layout.margin_mm + column * layout.cellWidthMm;
    const cellY = layout.margin_mm + row * layout.cellHeightMm;

    drawLabel(doc, label, cellX, cellY, layout);
  });

  return doc;
}
