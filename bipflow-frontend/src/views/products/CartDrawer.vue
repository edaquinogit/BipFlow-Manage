<template>
  <Transition name="cart-sheet">
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div
        class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        @click="$emit('close')"
      />

      <aside
        class="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <header class="border-b border-slate-200 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.24em] text-rose-600">
                Carrinho
              </p>
              <h2 class="mt-2 text-2xl font-semibold text-slate-900">
                {{ itemCount }} item<span v-if="itemCount !== 1">s</span> no pedido
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Revise produtos, ajuste quantidades e preencha os dados para agilizar o atendimento.
              </p>
            </div>

            <button
              type="button"
              class="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              aria-label="Fechar carrinho"
              @click="$emit('close')"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <div class="mt-5 grid grid-cols-4 gap-2" aria-label="Progresso do pedido">
            <div
              v-for="(step, index) in checkoutSteps"
              :key="step.key"
              class="rounded-2xl border px-2 py-2 text-center transition"
              :class="getCheckoutStepClass(index, step.complete)"
            >
              <span
                class="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                :class="step.complete ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'"
              >
                <CheckIcon v-if="step.complete" class="h-4 w-4" aria-hidden="true" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="mt-1 block truncate text-[11px] font-semibold">
                {{ step.label }}
              </span>
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto">
          <section class="border-b border-slate-200 px-6 py-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Itens selecionados
              </h3>

              <button
                v-if="items.length > 0"
                type="button"
                class="text-sm font-medium text-rose-600 transition hover:text-rose-700"
              @click="$emit('clearCart')"
              >
                Limpar carrinho
              </button>
            </div>

            <div v-if="items.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <p class="text-base font-medium text-slate-900">
                Seu carrinho ainda está vazio
              </p>
              <p class="mt-2 text-sm text-slate-500">
                Explore as categorias, escolha quantidades e monte um pedido completo sem sair da vitrine.
              </p>
            </div>

            <div v-else class="space-y-4">
              <article
                v-for="item in items"
                :key="item.product.id"
                class="rounded-2xl border border-slate-200 p-4 shadow-sm"
              >
                <div class="flex gap-4">
                  <img
                    :src="item.product.image || fallbackImageUrl"
                    :alt="`Imagem do produto ${item.product.name}`"
                    class="h-20 w-20 rounded-2xl bg-slate-100 object-cover"
                  />

                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {{ item.product.category.name }}
                        </p>
                        <h4 class="mt-1 text-base font-semibold text-slate-900">
                          {{ item.product.name }}
                        </h4>
                        <p class="mt-1 text-sm text-slate-500">
                          {{ formatBRL(item.product.price) }} por unidade
                        </p>
                      </div>

                      <button
                        type="button"
                        class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                        :aria-label="`Remover ${item.product.name} do carrinho`"
                        @click="$emit('removeItem', item.product.id)"
                      >
                        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fill-rule="evenodd" d="M8.257 3.099c.366-.446.911-.724 1.5-.724h.486c.589 0 1.134.278 1.5.724l.97 1.183h2.287a.75.75 0 010 1.5h-.614l-.64 8.316A2.25 2.25 0 0111.504 16H8.496a2.25 2.25 0 01-2.242-1.902l-.64-8.316H5a.75.75 0 010-1.5h2.287l.97-1.183zM8.717 4.282h2.566l-.39-.475a.438.438 0 00-.339-.157h-.108a.438.438 0 00-.339.157l-.39.475z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    <div class="mt-4 flex items-center justify-between">
                      <div class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          class="h-9 w-9 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-white"
                          :aria-label="`Diminuir quantidade de ${item.product.name}`"
                          @click="$emit('updateQuantity', item.product.id, item.quantity - 1)"
                        >
                          -
                        </button>
                        <span class="min-w-10 text-center text-sm font-semibold text-slate-900">
                          {{ item.quantity }}
                        </span>
                        <button
                          type="button"
                          class="h-9 w-9 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-white"
                          :aria-label="`Aumentar quantidade de ${item.product.name}`"
                          @click="$emit('updateQuantity', item.product.id, item.quantity + 1)"
                        >
                          +
                        </button>
                      </div>

                      <p class="text-base font-semibold text-slate-900">
                        {{ formatBRL(Number(item.product.price) * item.quantity) }}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="border-b border-slate-200 px-6 py-6">
            <div class="mb-4">
              <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Dados do cliente
              </h3>
              <p class="mt-2 text-sm text-slate-500">
                Esses campos deixam o pedido pronto para atendimento comercial ou envio pelo canal que sua equipe preferir.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="sm:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-700">Nome completo</span>
                <input
                  :value="customer.fullName"
                  type="text"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  placeholder="Digite o nome do cliente"
                  @input="handleTextInput('fullName', $event)"
                />
              </label>

              <label>
                <span class="mb-2 block text-sm font-medium text-slate-700">WhatsApp</span>
                <input
                  :value="customer.phone"
                  type="tel"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  placeholder="(71) 99999-9999"
                  @input="handleTextInput('phone', $event)"
                />
              </label>

              <label>
                <span class="mb-2 block text-sm font-medium text-slate-700">E-mail</span>
                <input
                  :value="customer.email"
                  type="email"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  placeholder="cliente@empresa.com"
                  @input="handleTextInput('email', $event)"
                />
              </label>

              <div>
                <span class="mb-2 block text-sm font-medium text-slate-700">Entrega</span>
                <div class="grid grid-cols-2 rounded-2xl border border-slate-300 bg-slate-50 p-1">
                  <button
                    type="button"
                    class="rounded-xl px-3 py-2 text-sm font-semibold transition"
                    :class="customer.deliveryMethod === 'delivery'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'"
                    :aria-pressed="customer.deliveryMethod === 'delivery'"
                    @click="selectDeliveryMethod('delivery')"
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    class="rounded-xl px-3 py-2 text-sm font-semibold transition"
                    :class="customer.deliveryMethod === 'pickup'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'"
                    :aria-pressed="customer.deliveryMethod === 'pickup'"
                    @click="selectDeliveryMethod('pickup')"
                  >
                    Retirada
                  </button>
                </div>
              </div>

              <div>
                <span class="mb-2 block text-sm font-medium text-slate-700">Pagamento</span>
                <div class="grid grid-cols-3 rounded-2xl border border-slate-300 bg-slate-50 p-1">
                  <button
                    v-for="option in paymentOptions"
                    :key="option.value"
                    type="button"
                    class="rounded-xl px-2 py-2 text-sm font-semibold transition"
                    :class="customer.paymentMethod === option.value
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'"
                    :aria-pressed="customer.paymentMethod === option.value"
                    @click="selectPaymentMethod(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <template v-if="customer.deliveryMethod === 'delivery'">
                <label class="sm:col-span-2">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Regiao de entrega</span>
                  <select
                    :value="customer.deliveryRegionId ?? ''"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    @change="handleDeliveryRegionChange"
                  >
                    <option value="" :disabled="deliveryRegions.length > 0">
                      {{ deliveryRegions.length > 0 ? 'Selecione a regiao' : 'Frete padrao' }}
                    </option>
                    <option
                      v-for="region in deliveryRegions"
                      :key="region.id"
                      :value="region.id"
                    >
                      {{ region.name }} - {{ formatBRL(region.delivery_fee) }}
                    </option>
                  </select>
                  <span class="mt-2 block text-xs text-slate-500">
                    Escolha uma regiao para calcular o frete do pedido.
                  </span>
                </label>

                <label class="sm:col-span-2">
                  <span class="mb-2 block text-sm font-medium text-slate-700">Endereco</span>
                  <input
                    :value="customer.address"
                    type="text"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    placeholder="Rua, numero e complemento"
                    @input="handleTextInput('address', $event)"
                  />
                </label>

                <label>
                  <span class="mb-2 block text-sm font-medium text-slate-700">Bairro</span>
                  <input
                    :value="customer.neighborhood"
                    type="text"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    placeholder="Bairro"
                    @input="handleTextInput('neighborhood', $event)"
                  />
                </label>

                <label>
                  <span class="mb-2 block text-sm font-medium text-slate-700">Cidade</span>
                  <input
                    :value="customer.city"
                    type="text"
                    class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    placeholder="Cidade"
                    @input="handleTextInput('city', $event)"
                  />
                </label>
              </template>

              <label class="sm:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-700">Observacoes</span>
                <textarea
                  :value="customer.notes"
                  rows="4"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  placeholder="Preferencias, horario de entrega ou detalhes do pedido"
                  @input="handleTextInput('notes', $event)"
                />
              </label>
            </div>
          </section>
        </div>

        <footer class="border-t border-slate-200 bg-slate-50 px-6 py-5">
          <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div
              class="mb-4 rounded-2xl border px-4 py-3"
              :class="canSubmitOrder
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'"
            >
              <div class="flex items-start gap-3">
                <span
                  class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  :class="canSubmitOrder ? 'bg-emerald-500' : 'bg-amber-500'"
                />
                <p class="text-sm font-semibold leading-5">
                  {{ checkoutBlockerMessage }}
                </p>
              </div>
            </div>

            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{{ formatBRL(subtotal) }}</span>
              </div>
              <div class="flex items-center justify-between text-slate-600">
                <span>Entrega</span>
                <span>{{ formatBRL(deliveryFee) }}</span>
              </div>
              <div class="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                <span>Total estimado</span>
                <span>{{ formatBRL(total) }}</span>
              </div>
            </div>

            <div class="mt-5">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                :disabled="!canSubmitOrder || isSubmitting"
                @click="$emit('submitOrder')"
              >
                {{ isSubmitting ? 'Gerando WhatsApp...' : 'Finalizar pedido no WhatsApp' }}
              </button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckIcon } from '@heroicons/vue/24/outline'
import type { DeliveryRegion } from '@/types/delivery'
import type { CartCustomer, CartItem } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const fallbackImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <rect width="240" height="240" fill="#e2e8f0" />
    <rect x="28" y="28" width="184" height="184" rx="24" fill="#cbd5e1" />
    <path d="M55 168l38-41c8-8 20-8 28 0l21 22 17-18c8-8 20-8 28 0l30 32v19H55z" fill="#94a3b8" />
  </svg>
`)}`;

const props = defineProps<{
  isOpen: boolean
  items: CartItem[]
  customer: CartCustomer
  deliveryRegions: DeliveryRegion[]
  itemCount: number
  subtotal: number
  deliveryFee: number
  total: number
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  close: []
  clearCart: []
  removeItem: [productId: number]
  updateQuantity: [productId: number, quantity: number]
  updateCustomer: [patch: Partial<CartCustomer>]
  submitOrder: []
}>()

const paymentOptions: { value: CartCustomer['paymentMethod']; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'card', label: 'Cartao' },
  { value: 'cash', label: 'Dinheiro' },
]

const hasCartItems = computed(() => props.items.length > 0)
const hasCustomerIdentity = computed(() => (
  Boolean(props.customer.fullName.trim()) && Boolean(props.customer.phone.trim())
))
const hasDeliveryRegion = computed(() => (
  props.customer.deliveryMethod !== 'delivery'
  || props.deliveryRegions.length === 0
  || Boolean(props.customer.deliveryRegionId)
))
const hasDeliveryAddress = computed(() => (
  props.customer.deliveryMethod !== 'delivery'
  || (
    Boolean(props.customer.address.trim())
    && Boolean(props.customer.neighborhood.trim())
    && Boolean(props.customer.city.trim())
  )
))
const hasDeliveryDetails = computed(() => hasDeliveryRegion.value && hasDeliveryAddress.value)
const canSubmitOrder = computed(() => (
  hasCartItems.value && hasCustomerIdentity.value && hasDeliveryDetails.value
))
const checkoutSteps = computed(() => [
  { key: 'items', label: 'Itens', complete: hasCartItems.value },
  { key: 'customer', label: 'Cliente', complete: hasCustomerIdentity.value },
  { key: 'delivery', label: 'Entrega', complete: hasDeliveryDetails.value },
  { key: 'send', label: 'WhatsApp', complete: canSubmitOrder.value },
])
const activeCheckoutStepIndex = computed(() => {
  const firstIncompleteIndex = checkoutSteps.value.findIndex((step) => !step.complete)
  return firstIncompleteIndex >= 0 ? firstIncompleteIndex : checkoutSteps.value.length - 1
})
const checkoutBlockerMessage = computed(() => {
  if (!hasCartItems.value) {
    return 'Adicione ao menos um produto para iniciar o pedido.'
  }

  if (!hasCustomerIdentity.value) {
    return 'Informe nome e WhatsApp do cliente antes de finalizar.'
  }

  if (!hasDeliveryRegion.value) {
    return 'Selecione a regiao de entrega para calcular o frete.'
  }

  if (!hasDeliveryAddress.value) {
    return 'Complete endereco, bairro e cidade para delivery.'
  }

  return 'Pedido pronto para abrir no WhatsApp.'
})

function updateField<K extends keyof CartCustomer>(field: K, value: CartCustomer[K]): void {
  emit('updateCustomer', { [field]: value } as Partial<CartCustomer>)
}

function handleTextInput<K extends keyof CartCustomer>(field: K, event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  updateField(field, target.value as CartCustomer[K])
}

function selectDeliveryMethod(deliveryMethod: CartCustomer['deliveryMethod']): void {
  emit('updateCustomer', {
    deliveryMethod,
    ...(deliveryMethod === 'pickup'
      ? {
          deliveryRegionId: null,
          deliveryRegionName: '',
          deliveryRegionFee: 12,
        }
      : {}),
  })
}

function selectPaymentMethod(paymentMethod: CartCustomer['paymentMethod']): void {
  updateField('paymentMethod', paymentMethod)
}

function handleDeliveryRegionChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  const regionId = Number(target.value)
  const selectedRegion = props.deliveryRegions.find((region) => region.id === regionId)

  if (!selectedRegion) {
    emit('updateCustomer', {
      deliveryRegionId: null,
      deliveryRegionName: '',
      deliveryRegionFee: 12,
    })
    return
  }

  emit('updateCustomer', {
    deliveryRegionId: selectedRegion.id,
    deliveryRegionName: selectedRegion.name,
    deliveryRegionFee: Number(selectedRegion.delivery_fee),
    city: selectedRegion.city || props.customer.city,
  })
}

function getCheckoutStepClass(index: number, isComplete: boolean): string {
  if (isComplete) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (index === activeCheckoutStepIndex.value) {
    return 'border-rose-200 bg-rose-50 text-rose-800'
  }

  return 'border-slate-200 bg-slate-50 text-slate-500'
}
</script>

<style scoped>
.cart-sheet-enter-active,
.cart-sheet-leave-active {
  transition: opacity 0.22s ease;
}

.cart-sheet-enter-active aside,
.cart-sheet-leave-active aside {
  transition: transform 0.26s ease;
}

.cart-sheet-enter-from,
.cart-sheet-leave-to {
  opacity: 0;
}

.cart-sheet-enter-from aside,
.cart-sheet-leave-to aside {
  transform: translateX(100%);
}
</style>
