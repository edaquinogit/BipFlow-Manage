import { computed, ref } from "vue";
import type { Product, ProductVariant } from "../schemas/product.schema";
import type { PdvSaleItemPayload } from "../types/pdvSale";
import { effectiveUnitPrice } from "../utils/pricing";

/**
 * Local running cart for the PDV screen (Etapa 3 of the QR-code stock-exit
 * evolution). Deliberately NOT a singleton -- like useStockMovements, this
 * state belongs to one screen instance, not to the whole dashboard session.
 */
export interface PdvCartLine {
  lineKey: string;
  productId: number;
  publicCode: string;
  variantId: number | null;
  variantName: string;
  variantColorHex: string;
  name: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  lowStockThreshold: number | null;
  imageUrl: string | null;
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
  | { ok: false; reason: "variant_required" }
  | { ok: false; reason: "exceeds_stock"; availableStock: number };

export type PdvCartQuantityResult =
  | { ok: true }
  | { ok: false; reason: "exceeds_stock"; availableStock: number };

export function getPdvCartLineKey(productId: number, variantId: number | null = null): string {
  return `${productId}:${variantId ?? "default"}`;
}

function normalizeStock(value: unknown): number {
  const stock = Number(value);
  return Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0;
}

function normalizeQuantity(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function activeProductVariants(product: Product): ProductVariant[] {
  return [...(product.variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort((left, right) => left.position - right.position || (left.id ?? 0) - (right.id ?? 0));
}

function availableStockForLine(product: Product, variant: ProductVariant | null): number {
  const productStock = normalizeStock(product.stock_quantity);
  if (!variant) {
    return productStock;
  }

  return Math.min(productStock, normalizeStock(variant.stock_quantity));
}

function imageUrlForLine(product: Product, variant: ProductVariant | null): string | null {
  if (typeof variant?.image === "string" && variant.image.length > 0) {
    return variant.image;
  }

  return product.image_url ?? null;
}

export function usePdvCart() {
  const lines = ref<PdvCartLine[]>([]);

  /**
   * Add a scanned/looked-up product to the cart. A second scan of the same
   * product increments its existing line instead of creating a duplicate
   * row -- the same "aggregate by code" behavior the backend itself applies
   * (bipdelivery/api/pdv.py's _aggregate_quantities()).
   */
  const addProduct = (
    product: Product,
    quantity = 1,
    variant: ProductVariant | null = null,
  ): PdvCartAddResult => {
    if (!product.id || !product.public_code || !product.is_available) {
      return { ok: false, reason: "unavailable" };
    }

    const activeVariants = activeProductVariants(product);
    let selectedVariant: ProductVariant | null = null;

    if (activeVariants.length > 0) {
      if (!variant?.id) {
        return { ok: false, reason: "variant_required" };
      }

      selectedVariant = activeVariants.find((candidate) => candidate.id === variant.id) ?? null;
      if (!selectedVariant) {
        return { ok: false, reason: "unavailable" };
      }
    }

    const availableStock = availableStockForLine(product, selectedVariant);
    if (availableStock <= 0) {
      return { ok: false, reason: "unavailable" };
    }

    const lineKey = getPdvCartLineKey(product.id, selectedVariant?.id ?? null);
    const quantityToAdd = normalizeQuantity(quantity);
    const existingLine = lines.value.find((line) => line.lineKey === lineKey);
    const nextQuantity = (existingLine?.quantity ?? 0) + quantityToAdd;

    if (nextQuantity > availableStock) {
      return { ok: false, reason: "exceeds_stock", availableStock };
    }

    if (existingLine) {
      existingLine.quantity = nextQuantity;
      existingLine.availableStock = availableStock;
      return { ok: true };
    }

    lines.value = [
      ...lines.value,
      {
        lineKey,
        productId: product.id,
        publicCode: product.public_code,
        variantId: selectedVariant?.id ?? null,
        variantName: selectedVariant?.name ?? "",
        variantColorHex: selectedVariant?.color_hex ?? "",
        name: product.name,
        // Display only -- the backend recomputes the sale total from the
        // scanned code + variant. Mirrors Product.get_effective_price.
        unitPrice: Number(effectiveUnitPrice(product, selectedVariant)),
        quantity: quantityToAdd,
        availableStock,
        lowStockThreshold: product.low_stock_threshold ?? null,
        imageUrl: imageUrlForLine(product, selectedVariant),
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
  const updateQuantity = (lineKey: string, quantity: number): PdvCartQuantityResult => {
    if (quantity <= 0) {
      removeLine(lineKey);
      return { ok: true };
    }

    const line = lines.value.find((candidate) => candidate.lineKey === lineKey);
    if (!line) {
      return { ok: true };
    }

    if (quantity > line.availableStock) {
      lines.value = lines.value.map((candidate) =>
        candidate.lineKey === lineKey ? { ...candidate, quantity: line.availableStock } : candidate
      );
      return { ok: false, reason: "exceeds_stock", availableStock: line.availableStock };
    }

    lines.value = lines.value.map((candidate) =>
      candidate.lineKey === lineKey ? { ...candidate, quantity } : candidate
    );
    return { ok: true };
  };

  const removeLine = (lineKey: string): void => {
    lines.value = lines.value.filter((line) => line.lineKey !== lineKey);
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
    lines.value.map((line) => {
      const item: PdvSaleItemPayload = {
        public_code: line.publicCode,
        quantity: line.quantity,
      };
      if (line.variantId !== null) {
        item.variant_id = line.variantId;
      }
      return item;
    });

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
