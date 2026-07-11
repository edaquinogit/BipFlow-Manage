import api from "./api";
import { Logger } from "./logger";
import {
  isAxiosError,
  isZodError,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";
import type { PdvSaleRequestPayload, PdvSaleResponse } from "../types/pdvSale";
import { PdvSaleResponseSchema } from "../types/pdvSale";

/**
 * Point-of-sale checkout for the physical store (Etapa 3 of the QR-code
 * stock-exit evolution) -- POST /v1/pdv/sales/. See
 * docs/architecture/qrcode-stock-exit-evolution.md and
 * bipdelivery/api/pdv.py.
 */
class PdvSaleService {
  private readonly endpoint = "v1/pdv/sales/";

  async create(payload: PdvSaleRequestPayload): Promise<PdvSaleResponse> {
    try {
      const { data } = await api.post<unknown>(this.endpoint, payload, {
        headers: { "Content-Type": "application/json" },
      });

      return PdvSaleResponseSchema.parse(data);
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Create PDV Sale");
      throw error;
    }
  }

  /**
   * PDV receipt PDF/email evolution: relays an already-built receipt PDF
   * (see utils/receiptPdf.ts) to the backend, which emails it to `email` as
   * an attachment. `orderReference` scopes the request to a real sale the
   * requester's store owns (bipdelivery/api/pdv.py's PdvReceiptEmailView).
   */
  async sendReceiptEmail(orderReference: string, email: string, pdfBase64: string): Promise<void> {
    try {
      await api.post<unknown>(
        `${this.endpoint}${encodeURIComponent(orderReference)}/receipt-email/`,
        { email, pdf_base64: pdfBase64 },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Send PDV Receipt Email");
      throw error;
    }
  }

  private handleError(error: ApplicationError, context: string): void {
    if (isZodError(error)) {
      Logger.error(
        `[PdvSaleService][${context}] Schema validation failed`,
        buildErrorContext(error)
      );
    } else if (isAxiosError(error)) {
      Logger.error(
        `[PdvSaleService][${context}] API request failed [HTTP ${error.response?.status}]`,
        buildErrorContext(error, { data: error.response?.data })
      );
    } else if (error instanceof Error) {
      Logger.error(
        `[PdvSaleService][${context}] Unexpected error: ${error.message}`,
        buildErrorContext(error)
      );
    } else {
      Logger.error(`[PdvSaleService][${context}] Unknown error occurred`, buildErrorContext(error));
    }
  }
}

export default new PdvSaleService();
