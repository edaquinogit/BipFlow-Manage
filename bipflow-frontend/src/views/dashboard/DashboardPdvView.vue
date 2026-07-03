<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { MinusIcon, PlusIcon, QrCodeIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { usePdvCart, type PdvCartLine } from '@/composables/usePdvCart';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useToast } from '@/composables/useToast';
import ProductService from '@/services/product.service';
import PdvSaleService from '@/services/pdvSale.service';
import { salesService } from '@/services/sales.service';
import { formatBRL } from '@/utils/formatters';
import { isLowStock } from '@/utils/stockAlerts';
import { Logger } from '@/services/logger';
import { isAxiosError } from '@/types/errors';
import { PDV_PAYMENT_METHODS, type PdvPaymentMethod, type PdvSaleResponse } from '@/types/pdvSale';
import type { SaleOrder } from '@/types/sales';
import PdvSaleReceiptModal from '@/components/dashboard/product-table/PdvSaleReceiptModal.vue';

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
 * Primary input is a plain focused text field, not a camera: most counter
 * QR/barcode scanners are USB "HID" devices that emulate a keyboard,
 * typing the code followed by Enter -- this works with any such scanner (or
 * a cashier just typing the code) with zero camera-permission friction. A
 * camera-based fallback is left for a later iteration (see the evolution
 * doc's Etapa 3 notes); this v1 covers the primary counter workflow.
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
    Logger.warn('Failed to load recent PDV sales', { error });
  } finally {
    isRecentSalesLoading.value = false;
  }
};
// Etapa R2 of the QR-code stock-exit refinement: a snapshot of the sale just
// completed, kept separately from the cart (which clears immediately) so
// the receipt modal has something to show after resetSale() runs.
const lastCompletedSale = ref<PdvSaleResponse | null>(null);
const isReceiptOpen = ref(false);

const focusScanInput = (): void => {
  void nextTick(() => scanInputRef.value?.focus());
};

const handleScanSubmit = async (): Promise<void> => {
  const code = scanValue.value.trim();
  if (!code || isLookingUp.value) {
    return;
  }

  isLookingUp.value = true;
  scanError.value = null;

  try {
    const product = await ProductService.getByCode(code);
    const result = cart.addProduct(product);

    if (!result.ok) {
      scanError.value =
        result.reason === 'exceeds_stock'
          ? `Estoque insuficiente para "${product.name}": disponível ${result.availableStock}.`
          : `"${product.name}" está indisponível no momento.`;
    }
  } catch (error: unknown) {
    scanError.value = `Código "${code}" não encontrado.`;
    Logger.warn('PDV code lookup failed', { error, code });
  } finally {
    isLookingUp.value = false;
    scanValue.value = '';
    focusScanInput();
  }
};

/**
 * Etapa R3 of the QR-code stock-exit refinement: a +/- stepper instead of a
 * raw number input -- bigger, more deliberate touch targets for a tablet at
 * a counter, and it can never be left in an invalid/empty intermediate
 * state the way a free-typed number field can.
 */
const adjustQuantity = (productId: number, delta: number): void => {
  const line = cart.lines.value.find((candidate) => candidate.productId === productId);
  if (!line) {
    return;
  }

  const result = cart.updateQuantity(productId, line.quantity + delta);
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

const handleRemoveLine = (productId: number): void => {
  cart.removeLine(productId);
  focusScanInput();
};

const resetSale = (): void => {
  cart.clear();
  customerName.value = '';
  customerPhone.value = '';
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
      notes: notes.value.trim() || undefined,
    });

    lastCompletedSale.value = response;
    isReceiptOpen.value = true;
    success(`Venda ${response.order_reference} registrada com sucesso.`);
    resetSale();
    void loadRecentPdvSales();
  } catch (error: unknown) {
    Logger.error('PDV sale failed', { error });
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

onMounted(() => {
  if (canManageCatalog.value) {
    void loadRecentPdvSales();
  }
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
      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
          Escanear ou digitar código
        </label>
        <input
          ref="scanInputRef"
          v-model="scanValue"
          type="text"
          autofocus
          data-cy="pdv-scan-input"
          placeholder="Aponte o leitor ou digite o código e pressione Enter"
          class="mt-2 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 font-mono text-sm uppercase text-[#05050A] outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          :disabled="isLookingUp"
          @keyup.enter="handleScanSubmit"
        />
        <p v-if="scanError" data-cy="pdv-scan-error" class="mt-2 text-xs font-bold text-[#D81B60]">
          {{ scanError }}
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
              <tr v-for="line in cart.lines.value" :key="line.productId" data-cy="pdv-cart-row">
                <td class="py-2 font-semibold">
                  {{ line.name }}
                  <span
                    v-if="isLineLowStock(line)"
                    data-cy="pdv-low-stock-badge"
                    class="ml-2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700"
                  >
                    Últimas unidades
                  </span>
                </td>
                <td class="py-2">
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      data-cy="pdv-cart-decrement"
                      aria-label="Diminuir quantidade"
                      :disabled="line.quantity <= 1"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] text-bip-muted transition hover:border-[#D81B60]/40 hover:text-[#D81B60] disabled:cursor-not-allowed disabled:opacity-40"
                      @click="adjustQuantity(line.productId, -1)"
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
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] text-bip-muted transition hover:border-[#D81B60]/40 hover:text-[#D81B60] disabled:cursor-not-allowed disabled:opacity-40"
                      @click="adjustQuantity(line.productId, 1)"
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
                    class="flex h-9 w-9 items-center justify-center text-bip-muted hover:text-[#D81B60]"
                    @click="handleRemoveLine(line.productId)"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!cart.isEmpty.value" class="mt-4 flex justify-end text-sm font-black">
          <span data-cy="pdv-cart-subtotal">Total: {{ formatBRL(cart.subtotal.value) }}</span>
        </div>
      </section>

      <section class="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>

        <button
          type="button"
          data-cy="pdv-finalize-sale"
          :disabled="cart.isEmpty.value || isSubmitting"
          class="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D81B60] text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#D81B60]/20 transition-all hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleFinalizeSale"
        >
          {{ isSubmitting ? 'Registrando...' : 'Finalizar venda' }}
        </button>
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
            <span class="shrink-0 font-mono font-black text-[#D81B60]">{{ formatBRL(order.total) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <PdvSaleReceiptModal
      :show="isReceiptOpen"
      :sale="lastCompletedSale"
      @close="closeReceipt"
    />
  </div>
</template>
