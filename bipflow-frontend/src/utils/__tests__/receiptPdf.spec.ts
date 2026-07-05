import { describe, it, expect } from "vitest";
import { buildReceiptPdf, buildReceiptPdfBase64 } from "../receiptPdf";
import type { ReceiptData } from "@/types/receipt";
import type { Store } from "@/types/store";

function buildSale(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    order_reference: "PDV-20260702-120000-000000",
    items: [
      { product_id: 7, product_name: "Coxinha premium", quantity: 2, unit_price: "18.50", line_total: "37.00" },
    ],
    total: "37.00",
    payment_method: "pix",
    created_at: "2026-07-02T12:00:00Z",
    ...overrides,
  };
}

function buildStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: "Boutique Fitness",
    slug: "boutique-fitness",
    whatsapp_phone: "5571999990000",
    is_active: true,
    receipt_exchange_policy: "Trocas em ate 7 dias.",
    receipt_paper_format: "80mm",
    ...overrides,
  };
}

describe("buildReceiptPdf", () => {
  it("builds a single-page PDF sized to the store's configured paper format", () => {
    const doc = buildReceiptPdf(buildSale(), buildStore({ receipt_paper_format: "58mm" }));

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(58, 0);
  });

  it("defaults to 80mm when there is no current store", () => {
    const doc = buildReceiptPdf(buildSale(), null);

    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(80, 0);
  });

  it("sizes an A4 receipt to 210mm wide", () => {
    const doc = buildReceiptPdf(buildSale(), buildStore({ receipt_paper_format: "a4" }));

    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
  });

  it("does not throw when the store has no exchange policy configured", () => {
    expect(() => buildReceiptPdf(buildSale(), buildStore({ receipt_exchange_policy: "" }))).not.toThrow();
  });

  it("grows the page height to fit a large number of items without clipping", () => {
    const manyItems = Array.from({ length: 30 }, (_, index) => ({
      product_id: index,
      product_name: `Produto ${index}`,
      quantity: 1,
      unit_price: "10.00",
      line_total: "10.00",
    }));

    const shortDoc = buildReceiptPdf(buildSale(), buildStore());
    const longDoc = buildReceiptPdf(buildSale({ items: manyItems }), buildStore());

    expect(longDoc.internal.pageSize.getHeight()).toBeGreaterThan(shortDoc.internal.pageSize.getHeight());
  });

  it("handles a very long product name by wrapping instead of throwing", () => {
    const sale = buildSale({
      items: [
        {
          product_id: 1,
          product_name: "Produto com um nome extremamente longo que certamente ultrapassa a largura da bobina",
          quantity: 1,
          unit_price: "10.00",
          line_total: "10.00",
        },
      ],
    });

    expect(() => buildReceiptPdf(sale, buildStore({ receipt_paper_format: "58mm" }))).not.toThrow();
  });
});

describe("buildReceiptPdfBase64", () => {
  it("returns a non-empty base64 string starting with a valid PDF header once decoded", () => {
    const base64 = buildReceiptPdfBase64(buildSale(), buildStore());

    expect(base64.length).toBeGreaterThan(0);
    const decoded = atob(base64.slice(0, 8));
    expect(decoded.startsWith("%PDF")).toBe(true);
  });
});
