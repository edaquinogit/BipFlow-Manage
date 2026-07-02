<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { QrCodeIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { usePdvCart } from '@/composables/usePdvCart';
import { useToast } from '@/composables/useToast';
import ProductService from '@/services/product.service';
import PdvSaleService from '@/services/pdvSale.service';
import { formatBRL } from '@/utils/formatters';
import { Logger } from '@/services/logger';
import { PDV_PAYMENT_METHODS, type PdvPaymentMethod } from '@/types/pdvSale';

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
const { success, error: toastError } = useToast();
const cart = usePdvCart();

const scanValue = ref('');
const scanInputRef = ref<HTMLInputElement | null>(null);
const scanError = ref<string | null>(null);
const isLookingUp = ref(false);

const paymentMethod = ref<PdvPaymentMethod>('pix');
const customerName = ref('');
const notes = ref('');
const isSubmitting = ref(false);
const lastOrderReference = ref<string | null>(null);

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
    cart.addProduct(product);
  } catch (error: unknown) {
    scanError.value = `Código "${code}" não encontrado.`;
    Logger.warn('PDV code lookup failed', { error, code });
  } finally {
    isLookingUp.value = false;
    scanValue.value = '';
    focusScanInput();
  }
};

const handleQuantityChange = (productId: number, rawValue: string): void => {
  const quantity = Number.parseInt(rawValue, 10);
  cart.updateQuantity(productId, Number.isFinite(quantity) ? quantity : 0);
};

const resetSale = (): void => {
  cart.clear();
  customerName.value = '';
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
      notes: notes.value.trim() || undefined,
    });

    lastOrderReference.value = response.order_reference;
    success(`Venda ${response.order_reference} registrada com sucesso.`);
    resetSale();
  } catch (error: unknown) {
    Logger.error('PDV sale failed', { error });
    toastError('Não foi possível registrar a venda. Verifique o estoque e tente novamente.');
  } finally {
    isSubmitting.value = false;
  }
};
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

        <table v-else class="w-full text-left text-sm" data-cy="pdv-cart-table">
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
              <td class="py-2 font-semibold">{{ line.name }}</td>
              <td class="py-2 text-center">
                <input
                  type="number"
                  min="1"
                  :value="line.quantity"
                  data-cy="pdv-cart-quantity"
                  class="w-16 rounded-lg border border-[#D1D5DB] px-2 py-1 text-center font-mono text-sm"
                  @change="handleQuantityChange(line.productId, ($event.target as HTMLInputElement).value)"
                />
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
                  class="text-bip-muted hover:text-[#D81B60]"
                  @click="cart.removeLine(line.productId)"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

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
    </template>
  </div>
</template>
