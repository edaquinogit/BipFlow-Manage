import { computed, ref } from "vue";
import type { Product } from "../schemas/product.schema";
import type { PdvSaleItemPayload } from "../types/pdvSale";

/**
 * Local running cart for the PDV screen (Etapa 3 of the QR-code stock-exit
 * evolution). Deliberately NOT a singleton -- like useStockMovements, this
 * state belongs to one screen instance, not to the whole dashboard session.
 */
export interface PdvCartLine {
  productId: number;
  publicCode: string;
  name: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  lowStockThreshold: number | null;
}

/**
 * Etapa R1 of the QR-code stock-exit refinement (see
 * docs/architecture/qrcode-stock-exit-refinement.md): scanning/typing a
 * quantity that the product can't cover is rejected here, at the moment it
 * happens, instead of only surfacing as a batch failure when the whole sale
 * is finalized (bipdelivery/api/pdv.py still re-validates at that point too
 * -- this is optimistic client-side feedback, not a replacement for it).
 */
export type PdvCartAddResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "exceeds_stock"; availableStock: number };

export type PdvCartQuantityResult =
  | { ok: true }
  | { ok: false; reason: "exceeds_stock"; availableStock: number };

export function usePdvCart() {
  const lines = ref<PdvCartLine[]>([]);

  /**
   * Add a scanned/looked-up product to the cart. A second scan of the same
   * product increments its existing line instead of creating a duplicate
   * row -- the same "aggregate by code" behavior the backend itself applies
   * (bipdelivery/api/pdv.py's _aggregate_quantities()).
   */
  const addProduct = (product: Product, quantity = 1): PdvCartAddResult => {
    if (!product.id || !product.public_code || !product.is_available || product.stock_quantity <= 0) {
      return { ok: false, reason: "unavailable" };
    }

    const existingLine = lines.value.find((line) => line.productId === product.id);
    const nextQuantity = (existingLine?.quantity ?? 0) + quantity;

    if (nextQuantity > product.stock_quantity) {
      return { ok: false, reason: "exceeds_stock", availableStock: product.stock_quantity };
    }

    if (existingLine) {
      existingLine.quantity = nextQuantity;
      existingLine.availableStock = product.stock_quantity;
      return { ok: true };
    }

    lines.value = [
      ...lines.value,
      {
        productId: product.id,
        publicCode: product.public_code,
        name: product.name,
        unitPrice: Number(product.price),
        quantity,
        availableStock: product.stock_quantity,
        lowStockThreshold: product.low_stock_threshold ?? null,
      },
    ];
    return { ok: true };
  };

  /**
   * Update a line's quantity directly (manual correction in the cart table).
   * Caps at the product's last-known available stock -- a client-side
   * courtesy, not the source of truth: the finalize call still re-validates
   * against the real, current stock under a row lock.
   */
  const updateQuantity = (productId: number, quantity: number): PdvCartQuantityResult => {
    if (quantity <= 0) {
      removeLine(productId);
      return { ok: true };
    }

    const line = lines.value.find((candidate) => candidate.productId === productId);
    if (!line) {
      return { ok: true };
    }

    if (quantity > line.availableStock) {
      lines.value = lines.value.map((candidate) =>
        candidate.productId === productId ? { ...candidate, quantity: line.availableStock } : candidate
      );
      return { ok: false, reason: "exceeds_stock", availableStock: line.availableStock };
    }

    lines.value = lines.value.map((candidate) =>
      candidate.productId === productId ? { ...candidate, quantity } : candidate
    );
    return { ok: true };
  };

  const removeLine = (productId: number): void => {
    lines.value = lines.value.filter((line) => line.productId !== productId);
  };

  const clear = (): void => {
    lines.value = [];
  };

  const subtotal = computed(() =>
    lines.value.reduce((total, line) => total + line.unitPrice * line.quantity, 0)
  );

  const itemCount = computed(() =>
    lines.value.reduce((count, line) => count + line.quantity, 0)
  );

  const isEmpty = computed(() => lines.value.length === 0);

  const toSaleItems = (): PdvSaleItemPayload[] =>
    lines.value.map((line) => ({ public_code: line.publicCode, quantity: line.quantity }));

  return {
    lines,
    addProduct,
    updateQuantity,
    removeLine,
    clear,
    subtotal,
    itemCount,
    isEmpty,
    toSaleItems,
  };
}
