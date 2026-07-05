import { jsPDF } from 'jspdf';
import type { ReceiptData } from '@/types/receipt';
import type { ReceiptPaperFormat, Store } from '@/types/store';
import { getPaymentLabel } from '@/constants/saleOrder';
import { formatBRL, formatDateTimeBR } from '@/utils/formatters';

/**
 * PDV receipt PDF/email evolution: generates an actual PDF file for the PDV
 * receipt client-side (no server-side PDF library exists in this project,
 * and adding one -- e.g. WeasyPrint -- would pull in native
 * Cairo/Pango dependencies for no real benefit, since the receipt's content
 * already lives in this same Vue app). Sized to the store's configured
 * `receipt_paper_format` (same 58mm/80mm/a4 presets as the print CSS in
 * PdvSaleReceiptModal.vue), so the PDF matches what a thermal printer or a
 * regular sheet would actually produce.
 */
const PAPER_WIDTH_MM: Record<ReceiptPaperFormat, number> = {
  '58mm': 58,
  '80mm': 80,
  a4: 210,
};

const MARGIN_MM = 4;
const LINE_HEIGHT_MM = 5;
const DEFAULT_FONT_SIZE_PT = 9;
const SMALL_FONT_SIZE_PT = 7;

interface WriteOptions {
  bold?: boolean;
  center?: boolean;
  right?: boolean;
  size?: number;
}

/**
 * Lays out the receipt onto `doc` starting at its current width, returning
 * the total content height (mm). When `draw` is false, nothing is actually
 * painted -- this lets buildReceiptPdf() measure the exact height a receipt
 * needs (item count and wrapped long lines vary) before creating the real,
 * correctly-sized page, instead of guessing a fixed height that could either
 * waste paper or clip content off the bottom.
 */
function layoutReceipt(
  doc: jsPDF,
  sale: ReceiptData,
  store: Store | null,
  width: number,
  draw: boolean
): number {
  const contentWidth = width - MARGIN_MM * 2;
  let y = MARGIN_MM;

  const writeLine = (text: string, options: WriteOptions = {}): void => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.size ?? DEFAULT_FONT_SIZE_PT);

    const lines = options.right ? [text] : (doc.splitTextToSize(text, contentWidth) as string[]);

    lines.forEach((line) => {
      if (draw) {
        const x = options.center ? width / 2 : options.right ? width - MARGIN_MM : MARGIN_MM;
        const align = options.center ? 'center' : options.right ? 'right' : 'left';
        doc.text(line, x, y, { align });
      }
      y += LINE_HEIGHT_MM;
    });
  };

  if (store?.name) {
    writeLine(store.name, { bold: true, center: true });
  }
  writeLine(sale.order_reference, { center: true, size: SMALL_FONT_SIZE_PT });
  writeLine(formatDateTimeBR(sale.created_at), { center: true, size: SMALL_FONT_SIZE_PT });
  y += 2;

  sale.items.forEach((item) => {
    writeLine(`${item.quantity}x ${item.product_name}`);
    writeLine(formatBRL(item.line_total), { right: true });
  });

  y += 1;
  writeLine(`Total: ${formatBRL(sale.total)}`, { bold: true });
  writeLine(`Pagamento: ${getPaymentLabel(sale.payment_method as 'pix' | 'card' | 'cash')}`);

  if (store?.receipt_exchange_policy) {
    y += 2;
    writeLine(store.receipt_exchange_policy, { center: true, size: SMALL_FONT_SIZE_PT });
  }

  return y + MARGIN_MM;
}

export function buildReceiptPdf(sale: ReceiptData, store: Store | null): jsPDF {
  const width = PAPER_WIDTH_MM[store?.receipt_paper_format ?? '80mm'];

  // Measurement pass: a tall scratch document (never rendered/downloaded)
  // just to find out how much height this specific receipt needs. 1000mm
  // is comfortably taller than any paper width above, so 'portrait' here
  // never needs to swap the dimensions jsPDF was given.
  const measureDoc = new jsPDF({ unit: 'mm', format: [width, 1000], orientation: 'portrait' });
  const totalHeight = layoutReceipt(measureDoc, sale, store, width, false);

  // jsPDF's `format: [w, h]` always enforces its own orientation regardless
  // of which number is larger (swapping them if needed to match) -- forcing
  // 'landscape' (width >= height) here would flip a real receipt (always
  // narrower than tall) on its side, so the height is floored to stay
  // taller than the width, keeping 'portrait' correct without relying on
  // jsPDF's own swap heuristic for a receipt short enough (few items) to
  // otherwise end up wider than it is tall.
  const pageHeight = Math.max(totalHeight, width + 10);
  const doc = new jsPDF({ unit: 'mm', format: [width, pageHeight], orientation: 'portrait' });
  layoutReceipt(doc, sale, store, width, true);

  return doc;
}

export function buildReceiptPdfBase64(sale: ReceiptData, store: Store | null): string {
  return buildReceiptPdf(sale, store).output('datauristring').split(',')[1] ?? '';
}
