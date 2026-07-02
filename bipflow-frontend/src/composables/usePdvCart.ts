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
}

export function usePdvCart() {
  const lines = ref<PdvCartLine[]>([]);

  /**
   * Add a scanned/looked-up product to the cart. A second scan of the same
   * product increments its existing line instead of creating a duplicate
   * row -- the same "aggregate by code" behavior the backend itself applies
   * (bipdelivery/api/pdv.py's _aggregate_quantities()).
   */
  const addProduct = (product: Product, quantity = 1): void => {
    if (!product.id || !product.public_code) {
      return;
    }

    const existingLine = lines.value.find((line) => line.productId === product.id);
    if (existingLine) {
      existingLine.quantity += quantity;
      return;
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
      },
    ];
  };

  const updateQuantity = (productId: number, quantity: number): void => {
    if (quantity <= 0) {
      removeLine(productId);
      return;
    }

    lines.value = lines.value.map((line) =>
      line.productId === productId ? { ...line, quantity } : line
    );
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
