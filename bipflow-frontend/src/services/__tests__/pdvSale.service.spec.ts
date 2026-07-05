import { beforeEach, describe, expect, it, vi } from "vitest";
import PdvSaleService from "../pdvSale.service";
import api from "../api";

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe("PdvSaleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the cart items and payment method, returning the parsed confirmation", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        order_reference: "PDV-20260702-120000-000000",
        items: [
          {
            product_id: 1,
            product_name: "Produto teste",
            public_code: "ABCD2345",
            quantity: 2,
            unit_price: "10.00",
            line_total: "20.00",
          },
        ],
        subtotal: "20.00",
        total: "20.00",
        payment_method: "pix",
        created_at: "2026-07-02T12:00:00Z",
      },
    } as never);

    const result = await PdvSaleService.create({
      items: [{ public_code: "ABCD2345", quantity: 2 }],
      payment_method: "pix",
    });

    expect(api.post).toHaveBeenCalledWith(
      "v1/pdv/sales/",
      { items: [{ public_code: "ABCD2345", quantity: 2 }], payment_method: "pix" },
      { headers: { "Content-Type": "application/json" } }
    );
    expect(result.order_reference).toBe("PDV-20260702-120000-000000");
    expect(result.items).toHaveLength(1);
  });

  it("propagates a rejection from the backend (e.g. insufficient stock)", async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { items: ['Produto "X" está indisponível.'] } },
    });

    await expect(
      PdvSaleService.create({
        items: [{ public_code: "ABCD2345", quantity: 999 }],
        payment_method: "cash",
      })
    ).rejects.toBeTruthy();
  });

  describe("sendReceiptEmail", () => {
    it("posts the email and base64 PDF to the order's receipt-email endpoint", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: { sent: true } } as never);

      await PdvSaleService.sendReceiptEmail(
        "PDV-20260702-120000-000000",
        "cliente@example.com",
        "JVBERi0xLjQ="
      );

      expect(api.post).toHaveBeenCalledWith(
        "v1/pdv/sales/PDV-20260702-120000-000000/receipt-email/",
        { email: "cliente@example.com", pdf_base64: "JVBERi0xLjQ=" },
        { headers: { "Content-Type": "application/json" } }
      );
    });

    it("propagates a rejection from the backend (e.g. invalid email)", async () => {
      vi.mocked(api.post).mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { email: ["Insira um endereço de email válido."] } },
      });

      await expect(
        PdvSaleService.sendReceiptEmail("PDV-20260702-120000-000000", "not-an-email", "JVBERi0xLjQ=")
      ).rejects.toBeTruthy();
    });
  });
});
