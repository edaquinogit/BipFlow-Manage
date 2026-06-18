<template>
  <Transition name="cart-sheet">
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div
        class="absolute inset-0 bg-[#05050A]/55 backdrop-blur-sm"
        @click="$emit('close')"
      />

      <aside class="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-[#FAFAFA] shadow-2xl">
        <header class="border-b border-[#E5E7EB] bg-white px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-[#D81B60]">Pedido</p>
              <h2 class="mt-2 text-2xl font-semibold text-[#05050A]">
                {{ itemCount }} item<span v-if="itemCount !== 1">s</span> no pedido
              </h2>
              <p class="mt-1 text-sm leading-6 text-[#6B7280]">
                Revise os produtos e siga para o WhatsApp. A loja combina entrega, pagamento e confirmacao por la.
              </p>
            </div>

            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition hover:border-[#D81B60] hover:text-[#D81B60]"
              aria-label="Fechar carrinho"
              @click="$emit('close')"
            >
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          <div v-if="items.length === 0" class="border-y border-dashed border-[#D1D5DB] py-10 text-center">
            <ShoppingBagIcon class="mx-auto h-10 w-10 text-[#D81B60]" aria-hidden="true" />
            <p class="mt-4 text-base font-semibold text-[#05050A]">Seu pedido esta vazio</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">
              Escolha uma peca na vitrine para iniciar o pedido.
            </p>
          </div>

          <div v-else>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-[#05050A]">Itens selecionados</h3>
              <button
                type="button"
                class="text-sm font-medium text-[#6B7280] transition hover:text-[#D81B60]"
                @click="$emit('clearCart')"
              >
                Limpar
              </button>
            </div>

            <div class="divide-y divide-[#E5E7EB]">
              <article
                v-for="item in items"
                :key="item.product.id"
                class="py-4 first:pt-0 last:pb-0"
              >
                <div class="flex gap-4">
                  <img
                    :src="item.product.image || fallbackImageUrl"
                    :alt="`Imagem do produto ${item.product.name}`"
                    class="h-20 w-20 rounded-lg bg-[#F4F1F3] object-cover"
                  />

                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-[#D81B60]">
                          {{ item.product.category.name }}
                        </p>
                        <h4 class="mt-1 line-clamp-2 text-base font-semibold leading-6 text-[#05050A]">
                          {{ item.product.name }}
                        </h4>
                        <p class="mt-1 text-sm text-[#6B7280]">
                          {{ formatBRL(item.product.price) }} por unidade
                        </p>
                      </div>

                      <button
                        type="button"
                        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] transition hover:bg-red-50 hover:text-red-600"
                        :aria-label="`Remover ${item.product.name} do pedido`"
                        @click="$emit('removeItem', item.product.id)"
                      >
                        <TrashIcon class="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="mt-4 flex items-center justify-between gap-3">
                      <div class="inline-flex h-10 items-center rounded-lg border border-[#D1D5DB] bg-white">
                        <button
                          type="button"
                          class="inline-flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA]"
                          :aria-label="`Diminuir quantidade de ${item.product.name}`"
                          @click="$emit('updateQuantity', item.product.id, item.quantity - 1)"
                        >
                          <MinusIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span class="min-w-9 text-center text-sm font-semibold text-[#05050A]">
                          {{ item.quantity }}
                        </span>
                        <button
                          type="button"
                          class="inline-flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA]"
                          :aria-label="`Aumentar quantidade de ${item.product.name}`"
                          @click="$emit('updateQuantity', item.product.id, item.quantity + 1)"
                        >
                          <PlusIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <p class="text-base font-semibold text-[#05050A]">
                        {{ formatBRL(Number(item.product.price) * item.quantity) }}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <section v-if="items.length > 0" class="mt-6 border-t border-[#E5E7EB] pt-6">
            <div class="mb-4">
              <h3 class="text-sm font-semibold text-[#05050A]">Dados para finalizar</h3>
            </div>

            <div class="grid gap-4">
              <label class="block">
                <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Nome
                </span>
                <input
                  :value="customer.fullName"
                  type="text"
                  autocomplete="name"
                  class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                  placeholder="Seu nome"
                  @input="handleTextField('fullName', $event)"
                />
              </label>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    WhatsApp
                  </span>
                  <input
                    :value="customer.phone"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    placeholder="+55 71 99999-9999"
                    @input="handleTextField('phone', $event)"
                  />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Email
                  </span>
                  <input
                    :value="customer.email"
                    type="email"
                    autocomplete="email"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    placeholder="Opcional"
                    @input="handleTextField('email', $event)"
                  />
                </label>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Entrega
                  </span>
                  <select
                    :value="customer.deliveryMethod"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    @change="handleDeliveryMethodChange"
                  >
                    <option value="delivery">Receber em casa</option>
                    <option value="pickup">Retirar na loja</option>
                  </select>
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Pagamento
                  </span>
                  <select
                    :value="customer.paymentMethod"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    @change="handlePaymentMethodChange"
                  >
                    <option value="pix">Pix</option>
                    <option value="card">Cartao</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                </label>
              </div>

              <template v-if="customer.deliveryMethod === 'delivery'">
                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Regiao de entrega
                  </span>
                  <select
                    :value="customer.deliveryRegionId ?? ''"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    :disabled="isDeliveryRegionsLoading || deliveryRegions.length === 0"
                    @change="handleDeliveryRegionChange"
                  >
                    <option value="">
                      {{ deliveryRegionPlaceholder }}
                    </option>
                    <option
                      v-for="region in deliveryRegions"
                      :key="region.id"
                      :value="region.id"
                    >
                      {{ region.name }} - {{ formatBRL(region.delivery_fee) }}
                    </option>
                  </select>
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    Endereco
                  </span>
                  <input
                    :value="customer.address"
                    type="text"
                    autocomplete="street-address"
                    class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                    placeholder="Rua, numero e complemento"
                    @input="handleTextField('address', $event)"
                  />
                </label>

                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="block">
                    <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Bairro
                    </span>
                    <input
                      :value="customer.neighborhood"
                      type="text"
                      autocomplete="address-level3"
                      class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                      placeholder="Bairro"
                      @input="handleTextField('neighborhood', $event)"
                    />
                  </label>

                  <label class="block">
                    <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      Cidade
                    </span>
                    <input
                      :value="customer.city"
                      type="text"
                      autocomplete="address-level2"
                      class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                      placeholder="Cidade"
                      @input="handleTextField('city', $event)"
                    />
                  </label>
                </div>
              </template>

              <label class="block">
                <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  Observacoes
                </span>
                <textarea
                  :value="customer.notes"
                  rows="3"
                  class="w-full resize-none rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                  placeholder="Tamanho, referencia ou combinados do pedido"
                  @input="handleTextField('notes', $event)"
                />
              </label>
            </div>
          </section>
        </div>

        <footer class="border-t border-[#E5E7EB] bg-white px-6 py-5">
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between text-[#6B7280]">
              <span>Subtotal dos produtos</span>
              <span class="font-semibold text-[#05050A]">{{ formatBRL(subtotal) }}</span>
            </div>
            <div
              v-if="customer.deliveryMethod === 'delivery' && deliveryFee > 0"
              class="flex items-center justify-between text-[#6B7280]"
            >
              <span>Frete</span>
              <span class="font-semibold text-[#05050A]">{{ formatBRL(deliveryFee) }}</span>
            </div>
            <div class="flex items-center justify-between border-t border-[#E5E7EB] pt-3 text-[#05050A]">
              <span class="font-semibold">Total estimado</span>
              <span class="text-lg font-semibold">{{ formatBRL(total) }}</span>
            </div>
            <p class="text-xs leading-5 text-[#6B7280]">
              O total final sera confirmado na mensagem gerada pela loja.
            </p>
            <p v-if="!isWhatsAppConfigured" class="border-l-4 border-amber-500 px-3 py-2 text-sm font-semibold text-amber-800">
              WhatsApp da loja ainda nao configurado.
            </p>
            <p
              v-if="checkoutValidationMessage"
              class="border-l-4 border-[#D81B60] px-3 py-2 text-sm font-semibold text-[#7A143D]"
            >
              {{ checkoutValidationMessage }}
            </p>
          </div>

          <button
            type="button"
            class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#05050A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#D81B60] disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
            :disabled="!canSubmitCheckout"
            @click="$emit('submitOrder')"
          >
            <ChatBubbleBottomCenterTextIcon class="h-5 w-5" aria-hidden="true" />
            {{ submitButtonLabel }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ChatBubbleBottomCenterTextIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { DeliveryRegion } from '@/types/delivery'
import type { CartCustomer, CartItem } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const fallbackImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <rect width="240" height="240" fill="#FAFAFA" />
    <rect x="28" y="28" width="184" height="184" rx="22" fill="#FFFFFF" stroke="#E5E7EB" />
    <rect x="64" y="68" width="112" height="76" rx="14" fill="#F4F1F3" />
    <path d="M76 132l26-27c5-5 13-5 18 0l17 18 9-10c5-5 14-5 19 0l29 30v14H76z" fill="#E9A8C0" />
    <text x="120" y="184" text-anchor="middle" fill="#6B7280" font-family="Arial, sans-serif" font-size="15" font-weight="700">Imagem em breve</text>
  </svg>
`)}`

const props = withDefaults(defineProps<{
  isOpen: boolean
  items: CartItem[]
  itemCount: number
  subtotal: number
  deliveryFee: number
  total: number
  customer: CartCustomer
  deliveryRegions: DeliveryRegion[]
  isDeliveryRegionsLoading?: boolean
  isSubmitting?: boolean
  isWhatsAppConfigured: boolean
}>(), {
  isDeliveryRegionsLoading: false,
  isSubmitting: false,
})

const emit = defineEmits<{
  close: []
  clearCart: []
  removeItem: [productId: number]
  updateQuantity: [productId: number, quantity: number]
  updateCustomer: [patch: Partial<CartCustomer>]
  submitOrder: []
}>()

type TextCustomerField =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'address'
  | 'neighborhood'
  | 'city'
  | 'notes'

const deliveryRegionPlaceholder = computed(() => {
  if (props.isDeliveryRegionsLoading) {
    return 'Carregando regioes...'
  }

  return props.deliveryRegions.length > 0
    ? 'Selecione uma regiao'
    : 'Combinar entrega com a loja'
})

const normalizedPhone = computed(() => props.customer.phone.replace(/\D/g, ''))

const checkoutValidationMessage = computed(() => {
  if (props.itemCount === 0) {
    return 'Adicione ao menos um item ao pedido.'
  }

  if (!props.customer.fullName.trim()) {
    return 'Informe seu nome para registrar o pedido.'
  }

  if (normalizedPhone.value.length < 10) {
    return 'Informe um WhatsApp com DDD.'
  }

  if (props.customer.deliveryMethod === 'delivery') {
    if (props.deliveryRegions.length > 0 && !props.customer.deliveryRegionId) {
      return 'Selecione a regiao de entrega.'
    }

    if (!props.customer.address.trim()) {
      return 'Informe o endereco de entrega.'
    }

    if (!props.customer.neighborhood.trim()) {
      return 'Informe o bairro de entrega.'
    }

    if (!props.customer.city.trim()) {
      return 'Informe a cidade de entrega.'
    }
  }

  return ''
})

const canSubmitCheckout = computed(() => (
  props.itemCount > 0
  && !props.isSubmitting
  && !checkoutValidationMessage.value
))

const submitButtonLabel = computed(() => {
  if (props.isSubmitting) {
    return 'Registrando pedido...'
  }

  return props.isWhatsAppConfigured ? 'Registrar e abrir WhatsApp' : 'Registrar pedido'
})

function getInputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function handleTextField(field: TextCustomerField, event: Event): void {
  emit('updateCustomer', {
    [field]: getInputValue(event),
  })
}

function handleDeliveryMethodChange(event: Event): void {
  const deliveryMethod = getInputValue(event) as CartCustomer['deliveryMethod']

  emit('updateCustomer', {
    deliveryMethod,
    ...(deliveryMethod === 'pickup'
      ? {
          deliveryRegionId: null,
          deliveryRegionName: '',
          deliveryRegionFee: 0,
          address: '',
          neighborhood: '',
          city: '',
        }
      : {}),
  })
}

function handlePaymentMethodChange(event: Event): void {
  emit('updateCustomer', {
    paymentMethod: getInputValue(event) as CartCustomer['paymentMethod'],
  })
}

function handleDeliveryRegionChange(event: Event): void {
  const regionId = Number(getInputValue(event))
  const region = props.deliveryRegions.find((item) => item.id === regionId)

  emit('updateCustomer', {
    deliveryRegionId: region?.id ?? null,
    deliveryRegionName: region?.name ?? '',
    deliveryRegionFee: region ? Number(region.delivery_fee) : 0,
  })
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
