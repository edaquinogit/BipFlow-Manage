<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { CameraIcon, EyeIcon, MinusIcon, PlusIcon, QrCodeIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { usePdvCart, type PdvCartAddResult, type PdvCartLine } from '@/composables/usePdvCart';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useToast } from '@/composables/useToast';
import ProductService from '@/services/product.service';
import PdvSaleService from '@/services/pdvSale.service';
import { salesService } from '@/services/sales.service';
import { formatBRL } from '@/utils/formatters';
import { isLowStock } from '@/utils/stockAlerts';
import { Logger } from '@/services/logger';
import { isAxiosError, buildErrorContext, type ApplicationError } from '@/types/errors';
import { PDV_PAYMENT_METHODS, type PdvPaymentMethod } from '@/types/pdvSale';
import type { SaleOrder } from '@/types/sales';
import type { ReceiptData } from '@/types/receipt';
import type { Product, ProductVariant } from '@/schemas/product.schema';
import { extractPublicCodeFromScan } from '@/utils/pdvScan';
import { playScanSuccessBeep } from '@/utils/sound';
import PdvSaleReceiptModal from '@/components/dashboard/product-table/PdvSaleReceiptModal.vue';
import PdvCameraScannerModal, {
  type PdvCameraFeedback,
} from '@/components/dashboard/product-table/PdvCameraScannerModal.vue';

const PDV_GENERIC_SALE_ERROR = 'Não foi possível registrar a venda. Verifique o estoque e tente novamente.';

/**
 * Etapa R1 of the QR-code stock-exit refinement (see
 * docs/architecture/qrcode-stock-exit-refinement.md): the backend already
 * computes a specific, actionable message ("Quantidade solicitada para X
 * excede o estoque disponível (N)") -- this surfaces it instead of always
 * showing the same generic toast, which left the cashier with no idea which
 * item in the cart actually failed.
 */
const extractPdvSaleErrorMessage = (error: unknown): string => {
  if (!isAxiosError(error)) {
    return PDV_GENERIC_SALE_ERROR;
  }

  const data = error.response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return PDV_GENERIC_SALE_ERROR;
  }

  const fieldErrors = Object.values(data).filter(
    (value): value is string[] => Array.isArray(value) && value.length > 0
  );
  const [firstFieldErrors] = fieldErrors;

  if (fieldErrors.length === 1 && firstFieldErrors?.length === 1) {
    return firstFieldErrors[0] ?? PDV_GENERIC_SALE_ERROR;
  }

  if (fieldErrors.length > 0) {
    return fieldErrors.flat().join(' ');
  }

  return PDV_GENERIC_SALE_ERROR;
};

/**
 * Etapa 3 of the QR-code stock-exit evolution (see
 * docs/architecture/qrcode-stock-exit-evolution.md): point-of-sale checkout
 * for the physical store.
 *
 * Primary input is a plain focused text field: most counter QR/barcode
 * scanners are USB "HID" devices that emulate a keyboard, typing the code
 * followed by Enter -- this works with any such scanner (or a cashier just
 * typing the code) with zero camera-permission friction. Etapa C2 of the
 * PDV camera-scanner evolution (see
 * docs/architecture/pdv-camera-scanner-refinement.md) adds a phone-camera
 * alternative on top of this same lookup, for stores without a dedicated
 * USB scanner.
 */
const { canManageCatalog } = useCurrentUser();
const { success, error: toastError, warning: toastWarning } = useToast();
const cart = usePdvCart();

const scanValue = ref('');
const scanInputRef = ref<HTMLInputElement | null>(null);
const scanError = ref<string | null>(null);
const isLookingUp = ref(false);

const paymentMethod = ref<PdvPaymentMethod>('pix');
const customerName = ref('');
const customerPhone = ref('');
// PDV receipt PDF/email evolution: optional, lets the cashier email the
// printed receipt right after the sale finalizes.
const customerEmail = ref('');
const notes = ref('');
const isSubmitting = ref(false);

// Etapa R4 of the QR-code stock-exit refinement: lets the cashier confirm a
// sale actually registered without leaving the PDV screen. Shows the most
// recent PDV sales regardless of exact day boundary -- a real "today only"
// filter would need a new date-range param on SaleOrderViewSet, which is
// more backend surface than this reassurance panel needs.
const recentPdvSales = ref<SaleOrder[]>([]);
const isRecentSalesLoading = ref(false);

const loadRecentPdvSales = async (): Promise<void> => {
  isRecentSalesLoading.value = true;
  try {
    const response = await salesService.list({ channel: 'loja_fisica', pageSize: 5 });
    recentPdvSales.value = response.results;
  } catch (error: unknown) {
    Logger.warn('Failed to load recent PDV sales', buildErrorContext(error as ApplicationError));
  } finally {
    isRecentSalesLoading.value = false;
  }
};
// Etapa R2 of the QR-code stock-exit refinement: a snapshot of the sale just
// completed, kept separately from the cart (which clears immediately) so
// the receipt modal has something to show after resetSale() runs. Also
// doubles (PDV receipt PDF/email evolution, Etapa E4) as the receipt shown
// when the cashier reopens a past sale from "Últimas vendas" -- a SaleOrder
// already structurally satisfies ReceiptData, so no adapter is needed.
const lastCompletedSale = ref<ReceiptData | null>(null);
const isReceiptOpen = ref(false);

const normalizeStock = (value: unknown): number => {
  const stock = Number(value);
  return Number.isFinite(stock) ? Math.max(0, Math.trunc(stock)) : 0;
};

const activeVariantsForProduct = (product: Product | null): ProductVariant[] =>
  [...(product?.variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort((left, right) => left.position - right.position || (left.id ?? 0) - (right.id ?? 0));

const variantAvailableStockForProduct = (product: Product, variant: ProductVariant): number => {
  if (!product.is_available) {
    return 0;
  }

  return Math.min(normalizeStock(product.stock_quantity), normalizeStock(variant.stock_quantity));
};

const variantImageUrl = (product: Product, variant: ProductVariant): string | null => {
  if (typeof variant.image === 'string' && variant.image.length > 0) {
    return variant.image;
  }

  return product.image_url ?? null;
};

const variantPickerProduct = ref<Product | null>(null);
const activeVariantOptions = computed<ProductVariant[]>(() =>
  activeVariantsForProduct(variantPickerProduct.value)
);
const variantPickerProductName = computed(() => variantPickerProduct.value?.name ?? '');

const variantAvailableStock = (variant: ProductVariant): number =>
  variantPickerProduct.value
    ? variantAvailableStockForProduct(variantPickerProduct.value, variant)
    : 0;

const variantImageUrlForPicker = (variant: ProductVariant): string | null =>
  variantPickerProduct.value ? variantImageUrl(variantPickerProduct.value, variant) : null;

const focusScanInput = (): void => {
  void nextTick(() => scanInputRef.value?.focus());
};

const closeVariantPicker = (): void => {
  variantPickerProduct.value = null;
  focusScanInput();
};

type PdvCartAddFailure = Extract<PdvCartAddResult, { ok: false }>;

const cartAddFailureMessage = (product: Product, result: PdvCartAddFailure): string => {
  if (result.reason === 'exceeds_stock') {
    return `Estoque insuficiente para "${product.name}": disponivel ${result.availableStock}.`;
  }

  if (result.reason === 'variant_required') {
    return `Selecione uma variante de "${product.name}" antes de vender no PDV.`;
  }

  return `"${product.name}" esta indisponivel no momento.`;
};

/**
 * Etapa C1/C2 of the PDV camera-scanner evolution: the one place that
 * resolves a raw scan (typed, HID-scanned, or camera-decoded) into a cart
 * addition. `extractPublicCodeFromScan()` is a no-op for a bare code (what
 * the text input/HID path always produced already) and only does real work
 * for a camera decode, whose raw text is the product's full deep-link URL,
 * not the bare `public_code` (see `utils/pdvScan.ts`).
 */
type PdvScanOutcome =
  | { ok: true; product: Product; action: 'added' | 'variant_required' }
  | { ok: false; message: string };

const resolveScannedCode = async (raw: string): Promise<PdvScanOutcome> => {
  const code = extractPublicCodeFromScan(raw);

  try {
    const product = await ProductService.getByCode(code);
    const activeVariants = activeVariantsForProduct(product);

    if (activeVariants.length > 0) {
      const hasAvailableVariant = activeVariants.some(
        (variant) => variantAvailableStockForProduct(product, variant) > 0
      );

      if (!hasAvailableVariant) {
        return {
          ok: false,
          message: `"${product.name}" esta indisponivel no momento.`,
        };
      }

      variantPickerProduct.value = product;
      return {
        ok: true,
        product,
        action: 'variant_required',
      };
    }

    variantPickerProduct.value = null;
    const result = cart.addProduct(product);

    if (!result.ok) {
      return {
        ok: false,
        message: cartAddFailureMessage(product, result),
      };
    }

    // Etapa C3 of the PDV camera-scanner evolution: one chokepoint for the
    // confirmation beep, so HID/manual/camera scans all get the same
    // feedback instead of only the camera's vibration.
    playScanSuccessBeep();
    return { ok: true, product, action: 'added' };
  } catch (error: unknown) {
    Logger.warn('PDV code lookup failed', buildErrorContext(error as ApplicationError, { code }));
    return { ok: false, message: `Código "${code}" não encontrado.` };
  }
};

const handleScanSubmit = async (): Promise<void> => {
  const raw = scanValue.value.trim();
  if (!raw || isLookingUp.value) {
    return;
  }

  isLookingUp.value = true;
  scanError.value = null;

  const outcome = await resolveScannedCode(raw);
  if (!outcome.ok) {
    scanError.value = outcome.message;
  }

  isLookingUp.value = false;
  scanValue.value = '';
  focusScanInput();
};

// Etapa C2 of the PDV camera-scanner evolution: same lookup as the text
// input, fed by PdvCameraScannerModal's decoded QR text instead of Enter on
// the scan field. The modal stays open across multiple decodes (a cashier
// rings up several items without reopening the camera each time), so
// feedback is shown inline in the modal rather than via the page's
// scanError paragraph, which would be hidden behind the camera overlay.
const isCameraScannerOpen = ref(false);
const cameraFeedback = ref<PdvCameraFeedback | null>(null);

const openCameraScanner = (): void => {
  cameraFeedback.value = null;
  isCameraScannerOpen.value = true;
};

const closeCameraScanner = (): void => {
  isCameraScannerOpen.value = false;
  cameraFeedback.value = null;
  focusScanInput();
};

const handleCameraDecode = async (rawText: string): Promise<void> => {
  if (isLookingUp.value) {
    return;
  }

  isLookingUp.value = true;
  const outcome = await resolveScannedCode(rawText);
  if (!outcome.ok) {
    cameraFeedback.value = { type: 'error', message: outcome.message };
  } else if (outcome.action === 'variant_required') {
    cameraFeedback.value = { type: 'success', message: `Selecione a variante de "${outcome.product.name}".` };
    isCameraScannerOpen.value = false;
  } else {
    cameraFeedback.value = { type: 'success', message: `"${outcome.product.name}" adicionado ao carrinho.` };
  }
  isLookingUp.value = false;
};

const handleSelectVariant = (variant: ProductVariant): void => {
  const product = variantPickerProduct.value;
  if (!product) {
    return;
  }

  const result = cart.addProduct(product, 1, variant);
  if (!result.ok) {
    scanError.value = cartAddFailureMessage(product, result);
    return;
  }

  scanError.value = null;
  playScanSuccessBeep();
  closeVariantPicker();
};

/**
 * Etapa R3 of the QR-code stock-exit refinement: a +/- stepper instead of a
 * raw number input -- bigger, more deliberate touch targets for a tablet at
 * a counter, and it can never be left in an invalid/empty intermediate
 * state the way a free-typed number field can.
 */
const adjustQuantity = (lineKey: string, delta: number): void => {
  const line = cart.lines.value.find((candidate) => candidate.lineKey === lineKey);
  if (!line) {
    return;
  }

  const result = cart.updateQuantity(lineKey, line.quantity + delta);
  if (!result.ok) {
    toastWarning(`Quantidade ajustada para o estoque disponível: ${result.availableStock}.`);
  }

  // The scanner "types" into whatever has focus. Editing a quantity moves
  // focus away from the scan input (Etapa R1 of the QR-code stock-exit
  // refinement) -- without this, the next scan would leak its keystrokes
  // into this quantity field instead of adding a new item.
  focusScanInput();
};

const isLineLowStock = (line: PdvCartLine): boolean =>
  isLowStock({
    stock_quantity: line.availableStock,
    is_available: true,
    low_stock_threshold: line.lowStockThreshold,
  });

const handleRemoveLine = (lineKey: string): void => {
  cart.removeLine(lineKey);
  focusScanInput();
};

const resetSale = (): void => {
  cart.clear();
  variantPickerProduct.value = null;
  customerName.value = '';
  customerPhone.value = '';
  customerEmail.value = '';
  notes.value = '';
  paymentMethod.value = 'pix';
  scanError.value = null;
  focusScanInput();
};

const handleFinalizeSale = async (): Promise<void> => {
  if (cart.isEmpty.value || isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await PdvSaleService.create({
      items: cart.toSaleItems(),
      payment_method: paymentMethod.value,
      customer_name: customerName.value.trim() || undefined,
      customer_phone: customerPhone.value.trim() || undefined,
      customer_email: customerEmail.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    });

    lastCompletedSale.value = response;
    isReceiptOpen.value = true;
    success(`Venda ${response.order_reference} registrada com sucesso.`);
    resetSale();
    void loadRecentPdvSales();
  } catch (error: unknown) {
    Logger.error('PDV sale failed', buildErrorContext(error as ApplicationError));
    toastError(extractPdvSaleErrorMessage(error));
  } finally {
    isSubmitting.value = false;
  }
};

const closeReceipt = (): void => {
  isReceiptOpen.value = false;
  lastCompletedSale.value = null;
  focusScanInput();
};

// PDV receipt PDF/email evolution (Etapa E4): reopens a past sale's receipt
// from the "Últimas vendas" panel in the same modal used for a
// just-finalized sale -- salesService.list() already fetches full item
// data (bipdelivery/api/serializers.py's SaleOrderSerializer), so this
// needs no extra request.
const handleViewReceipt = (order: SaleOrder): void => {
  lastCompletedSale.value = order;
  isReceiptOpen.value = true;
};

// Etapa R1 of the QR-code stock-exit refinement: every other dashboard view
// resets its own state on an active-store switch (DashboardOrdersView,
// DashboardOverviewView, DashboardProductsView, DashboardStockMovementsView,
// DashboardSupportView) -- the PDV screen didn't, so a cart started under
// one store could be finalized against a different one's products.
useStoreSwitchEffect(() => {
  if (!cart.isEmpty.value) {
    toastWarning('A loja ativa mudou. O carrinho foi limpo para evitar misturar produtos de lojas diferentes.');
  }
  resetSale();
  void loadRecentPdvSales();
});

// Etapa C3 of the PDV camera-scanner evolution: Ctrl/Cmd+Enter finalizes the
// sale without leaving the keyboard (mirrors Enter-to-scan already working
// hands-free with a HID reader); Esc clears a partially typed/scanned code
// in the scan field specifically -- not the whole sale, which would be an
// easy way to lose a counter's work by mistake.
const handleGlobalKeydown = (event: KeyboardEvent): void => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!cart.isEmpty.value && !isSubmitting.value) {
      void handleFinalizeSale();
    }
    return;
  }

  if (event.key === 'Escape' && variantPickerProduct.value) {
    event.preventDefault();
    closeVariantPicker();
    return;
  }

  if (event.key === 'Escape' && !isCameraScannerOpen.value && document.activeElement === scanInputRef.value) {
    scanValue.value = '';
  }
};

onMounted(() => {
  if (canManageCatalog.value) {
    void loadRecentPdvSales();
  }
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="space-y-8" data-cy="pdv-view">
    <header>
      <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Loja física</p>
      <h2 class="mt-1 text-2xl font-black italic uppercase tracking-tighter text-[#05050A]">
        Ponto de venda (PDV)
      </h2>
    </header>

    <div v-if="!canManageCatalog" data-cy="pdv-no-permission" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      Você não possui permissão para registrar vendas no PDV.
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div class="space-y-6">
      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
          Escanear ou digitar código
        </label>
        <div class="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            ref="scanInputRef"
            v-model="scanValue"
            type="text"
            autofocus
            data-cy="pdv-scan-input"
            placeholder="Aponte o leitor ou digite o código e pressione Enter"
            class="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 font-mono text-sm uppercase text-[#05050A] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
            :disabled="isLookingUp"
            @keyup.enter="handleScanSubmit"
          />
          <button
            type="button"
            data-cy="pdv-open-camera-scanner"
            aria-label="Escanear com a câmera"
            class="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#D1D5DB] text-sm font-bold uppercase tracking-wide text-bip-muted transition hover:border-[#111827]/40 hover:text-[#111827] active:scale-[0.98] sm:h-[3.125rem] sm:w-[3.125rem]"
            @click="openCameraScanner"
          >
            <CameraIcon class="h-5 w-5 shrink-0" />
            <span class="sm:hidden">Escanear com a câmera</span>
          </button>
        </div>
        <p
          v-if="scanError"
          data-cy="pdv-scan-error"
          role="alert"
          aria-live="polite"
          class="mt-2 text-xs font-bold text-[#111827]"
        >
          {{ scanError }}
        </p>
        <p class="mt-2 text-[10px] text-bip-muted">
          Atalho: <kbd class="rounded border border-[#D1D5DB] px-1 py-0.5 font-mono text-[9px]">Ctrl</kbd>
          + <kbd class="rounded border border-[#D1D5DB] px-1 py-0.5 font-mono text-[9px]">Enter</kbd> finaliza a venda.
        </p>
      </section>

      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <h3 class="mb-4 text-sm font-black uppercase tracking-widest text-[#05050A]">
          Carrinho da venda
        </h3>

        <div v-if="cart.isEmpty.value" data-cy="pdv-cart-empty" class="py-10 text-center text-sm text-bip-muted">
          <QrCodeIcon class="mx-auto mb-2 h-8 w-8 text-bip-muted/50" />
          Nenhum item escaneado ainda.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm" data-cy="pdv-cart-table">
            <thead>
              <tr class="text-[10px] uppercase tracking-widest text-bip-muted">
                <th class="pb-2">Produto</th>
                <th class="pb-2 text-center">Qtd.</th>
                <th class="pb-2 text-right">Unitário</th>
                <th class="pb-2 text-right">Total</th>
                <th class="pb-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E5E7EB]">
              <tr v-for="line in cart.lines.value" :key="line.lineKey" data-cy="pdv-cart-row">
                <td class="py-2 font-semibold">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="line.imageUrl"
                      :src="line.imageUrl"
                      :alt="line.name"
                      data-cy="pdv-cart-item-image"
                      class="h-9 w-9 shrink-0 rounded-lg border border-[#E5E7EB] object-cover"
                    />
                    <div
                      v-else
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-bip-muted"
                    >
                      <QrCodeIcon class="h-4 w-4" />
                    </div>
                    <div class="min-w-0">
                      <p class="truncate">{{ line.name }}</p>
                      <span
                        v-if="line.variantName"
                        data-cy="pdv-cart-variant-name"
                        class="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-[#05050A]"
                      >
                        <span
                          class="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                          :style="{ backgroundColor: line.variantColorHex || '#D1D5DB' }"
                          aria-hidden="true"
                        />
                        <span class="truncate">{{ line.variantName }}</span>
                      </span>
                      <span
                        v-if="isLineLowStock(line)"
                        data-cy="pdv-low-stock-badge"
                        class="mt-1 inline-block whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700"
                      >
                        Últimas unidades
                      </span>
                    </div>
                  </div>
                </td>
                <td class="py-2">
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      data-cy="pdv-cart-decrement"
                      aria-label="Diminuir quantidade"
                      :disabled="line.quantity <= 1"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] text-bip-muted transition hover:border-[#111827]/40 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
                      @click="adjustQuantity(line.lineKey, -1)"
                    >
                      <MinusIcon class="h-4 w-4" />
                    </button>
                    <span data-cy="pdv-cart-quantity" class="w-6 text-center font-mono text-sm font-black">
                      {{ line.quantity }}
                    </span>
                    <button
                      type="button"
                      data-cy="pdv-cart-increment"
                      aria-label="Aumentar quantidade"
                      :disabled="line.quantity >= line.availableStock"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] text-bip-muted transition hover:border-[#111827]/40 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
                      @click="adjustQuantity(line.lineKey, 1)"
                    >
                      <PlusIcon class="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td class="py-2 text-right font-mono">{{ formatBRL(line.unitPrice) }}</td>
                <td class="py-2 text-right font-mono font-bold">
                  {{ formatBRL(line.unitPrice * line.quantity) }}
                </td>
                <td class="py-2 text-right">
                  <button
                    type="button"
                    data-cy="pdv-cart-remove"
                    aria-label="Remover item"
                    class="flex h-9 w-9 items-center justify-center text-bip-muted hover:text-[#111827]"
                    @click="handleRemoveLine(line.lineKey)"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>
      </div>

      <div class="space-y-6 lg:sticky lg:top-6">
      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6" data-cy="pdv-total-card">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">Total da venda</p>
        <p role="status" data-cy="pdv-cart-subtotal" class="mt-1 text-4xl font-black tracking-tighter text-[#05050A]">
          {{ formatBRL(cart.subtotal.value) }}
        </p>
        <p class="mt-1 text-xs font-semibold text-bip-muted">
          {{ cart.itemCount.value }} {{ cart.itemCount.value === 1 ? 'item' : 'itens' }}
        </p>

        <button
          type="button"
          data-cy="pdv-finalize-sale"
          :disabled="cart.isEmpty.value || isSubmitting"
          class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111827] text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#111827]/20 transition-all hover:bg-[#111827]/90 disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleFinalizeSale"
        >
          {{ isSubmitting ? 'Registrando...' : 'Finalizar venda' }}
        </button>
      </section>

      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div class="space-y-4">
          <div class="flex flex-col gap-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              Forma de pagamento
            </label>
            <select
              v-model="paymentMethod"
              data-cy="pdv-payment-method"
              class="rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm"
            >
              <option v-for="method in PDV_PAYMENT_METHODS" :key="method" :value="method">
                {{ method === 'pix' ? 'Pix' : method === 'card' ? 'Cartão' : 'Dinheiro' }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              Cliente (opcional)
            </label>
            <input
              v-model="customerName"
              type="text"
              data-cy="pdv-customer-name"
              class="rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm"
              placeholder="Nome do cliente"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              Telefone (opcional)
            </label>
            <input
              v-model="customerPhone"
              type="tel"
              data-cy="pdv-customer-phone"
              class="rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm"
              placeholder="Ex.: 71999998888"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              E-mail (opcional)
            </label>
            <input
              v-model="customerEmail"
              type="email"
              data-cy="pdv-customer-email"
              class="rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm"
              placeholder="Para enviar o recibo por e-mail"
            />
          </div>
        </div>
      </section>

      <section v-if="isRecentSalesLoading || recentPdvSales.length > 0" class="rounded-xl border border-[#E5E7EB] bg-white p-6" data-cy="pdv-recent-sales">
        <h3 class="mb-4 text-sm font-black uppercase tracking-widest text-[#05050A]">
          Últimas vendas
        </h3>
        <div v-if="isRecentSalesLoading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-9 animate-pulse rounded-lg bg-zinc-100" />
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="order in recentPdvSales"
            :key="order.id"
            data-cy="pdv-recent-sale-row"
            class="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-zinc-50 px-3 py-2 text-xs"
          >
            <span class="min-w-0 truncate font-bold text-[#05050A]">{{ order.order_reference }}</span>
            <span class="shrink-0 font-mono font-black text-[#111827]">{{ formatBRL(order.total) }}</span>
            <button
              type="button"
              data-cy="pdv-recent-sale-view-receipt"
              aria-label="Ver recibo"
              class="shrink-0 rounded-lg p-1.5 text-bip-muted transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              @click="handleViewReceipt(order)"
            >
              <EyeIcon class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </section>
      </div>
      </div>
    </template>

    <div
      v-if="variantPickerProduct"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      data-cy="pdv-variant-picker"
      role="presentation"
      @click.self="closeVariantPicker"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdv-variant-picker-title"
        class="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl shadow-black/20"
      >
        <header class="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              Selecionar variante
            </p>
            <h3
              id="pdv-variant-picker-title"
              class="mt-1 truncate text-lg font-black uppercase tracking-tight text-[#05050A]"
            >
              {{ variantPickerProductName }}
            </h3>
          </div>
          <button
            type="button"
            data-cy="pdv-variant-picker-close"
            aria-label="Fechar seletor de variantes"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-bip-muted transition hover:bg-zinc-100 hover:text-[#05050A]"
            @click="closeVariantPicker"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </header>

        <div class="grid max-h-[62vh] gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          <button
            v-for="variant in activeVariantOptions"
            :key="variant.id ?? variant.name"
            type="button"
            data-cy="pdv-variant-option"
            :data-variant-id="variant.id ?? ''"
            :disabled="variantAvailableStock(variant) <= 0"
            class="flex min-h-24 w-full items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 text-left transition hover:border-[#111827]/50 hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-45"
            @click="handleSelectVariant(variant)"
          >
            <img
              v-if="variantImageUrlForPicker(variant)"
              :src="variantImageUrlForPicker(variant) || ''"
              :alt="variant.name"
              class="h-14 w-14 shrink-0 rounded-lg border border-[#E5E7EB] object-cover"
            />
            <span
              v-else
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB]"
              :style="{ backgroundColor: variant.color_hex }"
              aria-hidden="true"
            />

            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span
                  class="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  :style="{ backgroundColor: variant.color_hex }"
                  aria-hidden="true"
                />
                <span class="truncate text-sm font-black text-[#05050A]">{{ variant.name }}</span>
              </span>
              <span class="mt-1 block text-xs font-semibold text-bip-muted">
                {{ variantAvailableStock(variant) }} em estoque
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <PdvSaleReceiptModal
      :show="isReceiptOpen"
      :sale="lastCompletedSale"
      @close="closeReceipt"
    />

    <PdvCameraScannerModal
      :show="isCameraScannerOpen"
      :feedback="cameraFeedback"
      @close="closeCameraScanner"
      @decode="handleCameraDecode"
    />
  </div>
</template>
