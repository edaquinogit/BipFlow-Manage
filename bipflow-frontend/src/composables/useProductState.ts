import { reactive, watch, type Ref } from "vue";
import type { Product } from "@/schemas/product.schema";
import { productFormLogger } from "@/lib/logger";

/**
 * Form slice kept in a single `reactive()` object. We hydrate and merge with
 * `Object.assign` so the same proxy is always bound to child `v-model`s after
 * `await` and API round-trips (Vue 3 reactivity).
 */
export interface ProductFormState {
  name: string;
  price: number;
  stock_quantity: number;
  /** Mirrors `IdentitySection` v-model (id or empty), not the full `Category` object. */
  category: string | number | null | undefined;
  sku: string;
  /** Mirrors `ValuationSection` v-model (`string` only). */
  size: string;
  image: Product["image"];
  description: string | null | undefined;
  is_available: boolean;
}

export function createEmptyProductFormState(): ProductFormState {
  return {
    name: "",
    price: 0,
    stock_quantity: 0,
    category: undefined,
    sku: "",
    size: "",
    image: null,
    description: "",
    is_available: true,
  };
}

function categoryToFormValue(
  c: Product["category"],
): string | number | null | undefined {
  if (c === undefined || c === null) return c ?? undefined;
  if (typeof c === "object" && "id" in c) return c.id;
  return c;
}

/**
 * Maps an API/product object into the form shape without replacing the reactive root.
 */
function productToFormState(source: Product): ProductFormState {
  const image =
    source.image !== undefined && source.image !== null
      ? source.image
      : (source.image_url ?? null);

  return {
    name: source.name ?? "",
    price: Number(source.price ?? 0),
    stock_quantity: Number(source.stock_quantity ?? 0),
    category: categoryToFormValue(source.category),
    sku: source.sku ?? "",
    size: source.size ?? "",
    image,
    description: source.description ?? "",
    is_available: source.is_available ?? true,
  };
}

/**
 * Builds a partial form update from only the keys present on the patch.
 */
function partialProductToFormFragment(
  patch: Partial<Product>,
): Partial<ProductFormState> {
  const out: Partial<ProductFormState> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.price !== undefined) out.price = Number(patch.price);
  if (patch.stock_quantity !== undefined) {
    out.stock_quantity = Number(patch.stock_quantity);
  }
  if (patch.category !== undefined) {
    out.category = categoryToFormValue(patch.category);
  }
  if (patch.sku !== undefined) out.sku = patch.sku ?? "";
  if (patch.size !== undefined) out.size = patch.size ?? "";
  if (patch.image !== undefined) out.image = patch.image;
  if (patch.description !== undefined) out.description = patch.description;
  if (patch.is_available !== undefined) out.is_available = patch.is_available;
  if (patch.image_url !== undefined && patch.image === undefined) {
    out.image = patch.image_url;
  }
  return out;
}

export function useProductState(
  isOpen: Ref<boolean>,
  getInitial: () => Product | null | undefined,
  onPanelOpen?: () => void,
) {
  const form = reactive<ProductFormState>(createEmptyProductFormState());

  /**
   * Resets defaults, then merges the selected product in place on `form`.
   */
  function hydrateFromInitial(): void {
    const initial = getInitial() ?? null;
    Object.assign(form, createEmptyProductFormState());
    if (initial) {
      Object.assign(form, productToFormState(initial));
    }
    productFormLogger.debug(
      { hasInitial: Boolean(initial) },
      "Product form hydrated from initial",
    );
  }

  /**
   * Merges server fields into the same reactive form object (post-`await` safe).
   */
  function mergeFromServer(patch: Partial<Product>): void {
    const fragment = partialProductToFormFragment(patch);
    Object.assign(form, fragment);
    productFormLogger.debug(
      { keys: Object.keys(fragment) },
      "Product form merged from server",
    );
  }

  watch(
    [isOpen, () => getInitial()],
    ([open]) => {
      if (open) {
        onPanelOpen?.();
        hydrateFromInitial();
      }
    },
    { immediate: true },
  );

  return {
    form,
    hydrateFromInitial,
    mergeFromServer,
  };
}
