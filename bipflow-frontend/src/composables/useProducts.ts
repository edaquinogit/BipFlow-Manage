import { ref, computed } from "vue";
import type { Product } from "../schemas/product.schema";
import ProductService from "../services/product.service";
import { productsLogger } from "@/lib/logger";
import { PRODUCT_WRITABLE_KEY_SET } from "@/constants/productApiFields";
import { formatDrfErrorPayload, isAxiosError } from "@/lib/drfErrors";

// Singleton reactive store (shared across all useProducts() consumers).
const products = ref<Product[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

/**
 * Clears module-level catalog state. Intended for unit tests only.
 */
export function resetProductsCatalogForTests(): void {
  products.value = [];
  loading.value = false;
  error.value = null;
}

function getApiErrorDetail(err: unknown): string {
  if (isAxiosError(err) && err.response?.data !== undefined) {
    return formatDrfErrorPayload(err.response.data);
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

function getStockValue(p: Product): number {
  const withLegacy = p as Product & { stock?: number | string };
  if (p.stock_quantity !== undefined && p.stock_quantity !== null) {
    return Number(p.stock_quantity);
  }
  if (withLegacy.stock !== undefined && withLegacy.stock !== null) {
    return Number(withLegacy.stock);
  }
  return 0;
}

function appendCategoryToFormData(
  formData: FormData,
  key: string,
  value: unknown,
): void {
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "number"
  ) {
    formData.append(key, String((value as { id: number }).id));
    return;
  }
  formData.append(key, String(value));
}

/**
 * 🛰️ BIPFLOW PRODUCT HUB — shared catalog state and persistence.
 */
export function useProducts() {
  const _preparePayload = (data: Partial<Product>): FormData => {
    const formData = new FormData();
    const MAX_FILE_SIZE = 2 * 1024 * 1024;

    Object.entries(data).forEach(([key, value]) => {
      if (!PRODUCT_WRITABLE_KEY_SET.has(key)) return;
      if (value === null || value === undefined) return;

      if (
        (key === "sku" || key === "size") &&
        typeof value === "string" &&
        value.trim() === ""
      ) {
        return;
      }

      if (key === "image") {
        if (value instanceof File) {
          if (value.size > MAX_FILE_SIZE) {
            throw new Error("The image exceeds the 2MB limit.");
          }
          formData.append(key, value);
        }
        return;
      }

      if (key === "price" || key === "stock" || key === "stock_quantity") {
        formData.append(key, String(value === "" ? 0 : value));
      } else if (typeof value === "object") {
        appendCategoryToFormData(formData, key, value);
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  const totalRevenue = computed(() => {
    const total = products.value.reduce((acc, p) => {
      const price = Number(p.price || 0);
      return acc + price * getStockValue(p);
    }, 0);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(total);
  });

  const inventoryStats = computed(() => ({
    totalItems: products.value.reduce((acc, p) => acc + getStockValue(p), 0),
    lowStockCount: products.value.filter((p) => getStockValue(p) < 5).length,
  }));

  const fetchData = async () => {
    loading.value = true;
    error.value = null;
    try {
      products.value = await ProductService.getAll();
      productsLogger.info({ count: products.value.length }, "Catalog synced");
    } catch (err: unknown) {
      const msg = getApiErrorDetail(err);
      error.value = `BipFlow: NYC Station Sync Failed (${msg})`;
      productsLogger.error({ err }, "Fetch catalog failed");
    } finally {
      loading.value = false;
    }
  };

  const createProduct = async (
    data: Partial<Product>,
  ): Promise<Product | undefined> => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const newAsset = await ProductService.create(payload);

      products.value = [newAsset, ...products.value];
      productsLogger.info({ id: newAsset.id }, "Product created");
      return newAsset;
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Deployment failed: ${apiMessage}`;
      productsLogger.error({ err, apiMessage }, "Create product failed");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateProduct = async (id: number, data: Partial<Product>) => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const updatedAsset = await ProductService.update(id, payload);

      const idx = products.value.findIndex((p) => p.id === id);
      if (idx !== -1) {
        Object.assign(products.value[idx], updatedAsset);
      } else {
        products.value = [updatedAsset, ...products.value];
        productsLogger.warn({ id }, "Updated product missing locally; prepended");
      }

      productsLogger.info({ id }, "Product updated in catalog");
      return updatedAsset;
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Synchronization failed: ${apiMessage}`;
      productsLogger.error({ err, id, apiMessage }, "Update product failed");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (id: number) => {
    loading.value = true;
    try {
      await ProductService.delete(id);
      products.value = products.value.filter((p) => p.id !== id);
      productsLogger.info({ id }, "Product deleted");
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Critical: Purge sequence failed (${apiMessage})`;
      productsLogger.error({ err, id }, "Delete product failed");
    } finally {
      loading.value = false;
    }
  };

  return {
    products,
    loading,
    error,
    totalRevenue,
    inventoryStats,
    fetchData,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
