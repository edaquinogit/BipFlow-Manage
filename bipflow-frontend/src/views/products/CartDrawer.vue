<template>
  <Transition name="cart-sheet">
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-[#05050A]/55 backdrop-blur-sm" @click="$emit('close')" />

      <aside ref="containerRef" role="dialog" aria-modal="true" aria-label="Carrinho de pedido" class="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-[#F8F8F9] shadow-2xl">
        <header class="border-b border-[#E5E7EB] bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#D81B60]">Pedido</p>
              <h2 class="mt-1.5 text-lg font-bold tracking-tight text-[#05050A] sm:mt-2 sm:text-xl">{{ itemCount }} item<span v-if="itemCount !== 1">s</span> no pedido</h2>
              <p class="mt-1 max-w-[34rem] text-xs leading-5 text-[#6B7280] sm:text-sm">Revise os itens e envie o pedido pelo WhatsApp.</p>
            </div>

            <button ref="closeButtonRef" type="button" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] transition hover:border-[#D81B60] hover:text-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] active:bg-[#FAFAFA]" aria-label="Fechar carrinho" @click="$emit('close')">
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div v-if="items.length === 0" class="border-y border-dashed border-[#D1D5DB] py-10 text-center">
            <ShoppingBagIcon class="mx-auto h-10 w-10 text-[#D81B60]" aria-hidden="true" />
            <p class="mt-4 text-base font-semibold text-[#05050A]">Seu pedido esta vazio</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">Escolha uma peca na vitrine para iniciar o pedido.</p>
          </div>

          <div v-else>
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-bold text-[#05050A]">Itens selecionados</h3>
              <button type="button" class="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#6B7280] transition hover:bg-white hover:text-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]" @click="$emit('clearCart')">Limpar</button>
            </div>

            <div class="divide-y divide-[#E5E7EB]">
              <article v-for="item in items" :key="item.product.id" class="py-5 first:pt-2 last:pb-1">
                <div class="flex gap-3 sm:gap-4">
                  <img :src="item.product.image || fallbackImageUrl" :alt="`Imagem do produto ${item.product.name}`" class="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl bg-[#F4F1F3] object-cover sm:h-20 sm:w-20" loading="lazy" />

                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold uppercase tracking-[0.08em] text-[#D81B60]">
                          {{ item.product.category.name }}
                        </p>
                        <h4 class="mt-1 line-clamp-2 text-[15px] font-bold leading-5 text-[#05050A] sm:text-base sm:leading-6">
                          {{ item.product.name }}
                        </h4>
                        <p class="mt-1 text-[13px] text-[#6B7280] sm:text-sm">{{ formatBRL(item.product.price) }} / unidade</p>
                      </div>

                      <button type="button" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#9CA3AF] transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100" :aria-label="`Remover ${item.product.name} do pedido`" @click="$emit('removeItem', item.product.id)">
                        <TrashIcon class="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div class="mt-4 flex items-center justify-between gap-3">
                      <div class="inline-flex h-11 items-center rounded-xl border border-[#D1D5DB] bg-white shadow-sm">
                        <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-l-xl text-[#6B7280] transition hover:bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#FCE7F3]" :aria-label="`Diminuir quantidade de ${item.product.name}`" @click="$emit('updateQuantity', item.product.id, item.quantity - 1)">
                          <MinusIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span class="min-w-9 text-center text-sm font-semibold text-[#05050A]">
                          {{ item.quantity }}
                        </span>
                        <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-r-xl text-[#6B7280] transition hover:bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#FCE7F3]" :aria-label="`Aumentar quantidade de ${item.product.name}`" @click="$emit('updateQuantity', item.product.id, item.quantity + 1)">
                          <PlusIcon class="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <p class="text-base font-bold text-[#05050A]">
                        {{ formatBRL(Number(item.product.price) * item.quantity) }}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <section v-if="items.length > 0" class="mt-5 border-t border-[#D9DADD] pt-5 sm:mt-6 sm:pt-6">
            <div class="mb-4">
              <h3 class="text-sm font-bold text-[#05050A]">Dados para finalizar</h3>
            </div>

            <div class="grid gap-3.5">
              <div v-if="hasProfileIdentity && hasCompleteProfileAddress" class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <p class="font-semibold">{{ profileSummary }}</p>
                <p class="mt-1 leading-5">{{ profileAddressSummary }}</p>
                <RouterLink :to="accountRoute" class="mt-2 inline-flex font-semibold text-[#D81B60] hover:underline"> Editar endereco </RouterLink>
              </div>

              <div v-else-if="hasProfileIdentity" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <p class="font-semibold">Complete o endereco do perfil para finalizar.</p>
                <p class="mt-1 leading-5">O pedido usa o endereco salvo na sua conta.</p>
                <RouterLink :to="accountRoute" class="mt-2 inline-flex font-semibold text-[#D81B60] hover:underline"> Completar endereco </RouterLink>
              </div>

              <div v-else class="rounded-xl border border-[#FCE7F3] bg-[#FFF4F8] px-3 py-3 text-sm text-[#7A143D]">
                <p class="font-semibold">Crie seu perfil para finalizar este pedido.</p>
                <p class="mt-1 leading-5">Nome, WhatsApp e endereco ficam salvos no cadastro.</p>
                <RouterLink :to="createProfileRoute" class="mt-2 inline-flex font-semibold text-[#D81B60] hover:underline"> Criar perfil </RouterLink>
              </div>

              <div class="grid gap-4">
                <section data-cy="checkout-payment-panel" class="rounded-xl border bg-white p-3 shadow-sm" :class="paymentPanel.borderClass">
                  <label class="block">
                    <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"> Pagamento </span>
                    <select :value="customer.paymentMethod" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" @change="handlePaymentMethodChange">
                      <option value="pix">Pix</option>
                      <option value="card">Cartao</option>
                    </select>
                  </label>

                  <div class="mt-3 flex gap-3">
                    <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" :class="paymentPanel.iconClass">
                      <component :is="paymentPanel.icon" class="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-[#05050A]">
                        {{ paymentPanel.title }}
                      </p>
                      <p class="mt-1 text-xs leading-5 text-[#6B7280]">
                        {{ paymentPanel.description }}
                      </p>
                      <p class="mt-2 text-[11px] font-semibold uppercase tracking-wide" :class="paymentPanel.statusClass">
                        {{ paymentPanel.status }}
                      </p>
                    </div>
                  </div>
                  <label v-if="customer.paymentMethod === 'card' && installmentOptions.length > 1" class="mt-3 block">
                    <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"> Parcelas </span>
                    <select
                      :value="customer.paymentInstallments"
                      data-cy="checkout-installments-select"
                      class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                      @change="handlePaymentInstallmentsChange"
                    >
                      <option v-for="option in installmentOptions" :key="option.installments" :value="option.installments">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <p data-cy="checkout-payment-link-status" class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold leading-5 text-zinc-700">
                    {{ paymentLinkStatus }}
                  </p>

                  <p data-cy="checkout-cash-store-only" class="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold leading-5 text-zinc-700">
                    Dinheiro somente no caixa da loja.
                  </p>
                </section>
              </div>

              <template v-if="hasProfileIdentity && hasCompleteProfileAddress && (isDeliveryRegionsLoading || deliveryRegions.length > 0)">
                <label class="block">
                  <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"> Regiao </span>
                  <select :value="customer.deliveryRegionId ?? ''" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" :disabled="isDeliveryRegionsLoading || deliveryRegions.length === 0" @change="handleDeliveryRegionChange">
                    <option value="">
                      {{ deliveryRegionPlaceholder }}
                    </option>
                    <option v-for="region in deliveryRegions" :key="region.id" :value="region.id">{{ region.name }} - {{ formatBRL(region.delivery_fee) }}</option>
                  </select>
                </label>
              </template>

              <label class="block">
                <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]"> Observacoes </span>
                <textarea :value="customer.notes" rows="3" class="w-full resize-none rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="Tamanho, referencia ou combinados do pedido" @input="handleNotesInput" />
              </label>
            </div>
          </section>
        </div>

        <footer class="cart-summary-footer z-10 border-t border-[#E5E7EB] bg-white px-4 py-4 shadow-[0_-8px_24px_-22px_rgba(5,5,10,0.6)] sm:px-6 sm:py-5">
          <div class="cart-summary-list space-y-2.5 text-sm">
            <div class="cart-summary-row flex items-center justify-between text-[#6B7280]">
              <span>Produtos</span>
              <span class="font-semibold text-[#05050A]">{{ formatBRL(subtotal) }}</span>
            </div>
            <div v-if="deliveryFee > 0" class="cart-summary-row flex items-center justify-between text-[#6B7280]">
              <span>Frete</span>
              <span class="font-semibold text-[#05050A]">{{ formatBRL(deliveryFee) }}</span>
            </div>
            <div class="cart-total-row flex items-center justify-between border-t border-[#E5E7EB] pt-3 text-[#05050A]">
              <span class="font-bold">Total estimado</span>
              <span class="text-xl font-bold tracking-tight">{{ formatBRL(total) }}</span>
            </div>
            <p class="cart-summary-note text-[11px] leading-4 text-[#6B7280]">Valor final confirmado no WhatsApp.</p>
            <p v-if="!isWhatsAppConfigured" class="cart-summary-alert rounded-r-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">WhatsApp da loja ainda nao configurado.</p>
            <p v-if="checkoutValidationMessage" class="cart-summary-alert rounded-r-lg border-l-4 border-[#D81B60] bg-[#FFF4F8] px-3 py-2 text-sm font-semibold text-[#7A143D]">
              {{ checkoutValidationMessage }}
            </p>
          </div>

          <button type="button" data-cy="checkout-submit-button" class="cart-summary-cta mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#05050A] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#D81B60] focus:outline-none focus:ring-4 focus:ring-[#FCE7F3] disabled:cursor-not-allowed disabled:bg-[#D1D5DB] sm:mt-5" :disabled="!canSubmitCheckout" @click="$emit('submitOrder')">
            <ChatBubbleBottomCenterTextIcon class="h-5 w-5" aria-hidden="true" />
            {{ submitButtonLabel }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChatBubbleBottomCenterTextIcon, CreditCardIcon, MinusIcon, PlusIcon, QrCodeIcon, ShoppingBagIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { createCustomerProfilePath, customerAccountPath } from '@/router/auth.routes'
import type { CustomerProfile } from '@/types/customer'
import type { DeliveryRegion } from '@/types/delivery'
import type { CartCustomer, CartItem } from '@/types/product'
import type { PublicPaymentGatewaySettings } from '@/types/store-settings'
import { formatBRL } from '@/utils/formatters'
import { useDialogA11y } from '@/composables/useDialogA11y'
import {
  DEFAULT_PUBLIC_PAYMENT_GATEWAY,
  buildCardInstallmentOptions,
} from '@/utils/paymentInstallments'

const fallbackImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <rect width="240" height="240" fill="#FAFAFA" />
    <rect x="28" y="28" width="184" height="184" rx="22" fill="#FFFFFF" stroke="#E5E7EB" />
    <rect x="64" y="68" width="112" height="76" rx="14" fill="#F4F1F3" />
    <path d="M76 132l26-27c5-5 13-5 18 0l17 18 9-10c5-5 14-5 19 0l29 30v14H76z" fill="#E9A8C0" />
    <text x="120" y="184" text-anchor="middle" fill="#6B7280" font-family="Arial, sans-serif" font-size="15" font-weight="700">Imagem em breve</text>
  </svg>
`)}`

const props = withDefaults(
  defineProps<{
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
    profile: CustomerProfile | null
    paymentGateway?: PublicPaymentGatewaySettings
  }>(),
  {
    isDeliveryRegionsLoading: false,
    isSubmitting: false,
    paymentGateway: () => DEFAULT_PUBLIC_PAYMENT_GATEWAY,
  },
)

const emit = defineEmits<{
  close: []
  clearCart: []
  removeItem: [productId: number]
  updateQuantity: [productId: number, quantity: number]
  updateCustomer: [patch: Partial<CartCustomer>]
  submitOrder: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

useDialogA11y(toRef(props, 'isOpen'), () => emit('close'), containerRef, closeButtonRef)

const route = useRoute()
const accountRoute = computed(() => {
  const storeSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
  return { path: customerAccountPath(storeSlug) }
})

const createProfileRoute = computed(() => {
  const storeSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
  return {
    path: createCustomerProfilePath(storeSlug),
    query: { redirect: route.fullPath },
  }
})

const hasProfileIdentity = computed(() => props.profile !== null)
const hasCompleteProfileAddress = computed(() => !!props.profile?.address?.trim() && !!props.profile?.neighborhood?.trim() && !!props.profile?.city?.trim())
const profileSummary = computed(() => {
  if (!props.profile) {
    return ''
  }

  return `${props.profile.full_name} - ${props.profile.phone}`
})
const profileAddressSummary = computed(() => {
  if (!props.profile) {
    return ''
  }

  return [props.profile.address, props.profile.neighborhood, props.profile.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
})

const paymentPanel = computed(() => {
  if (props.customer.paymentMethod === 'card') {
    return {
      icon: CreditCardIcon,
      title: 'Cartao',
      description: 'O pedido recebe uma referencia para conferencia do pagamento no cartao.',
      status: 'Confirmar transacao no atendimento',
      borderClass: 'border-sky-200',
      iconClass: 'bg-sky-50 text-sky-700',
      statusClass: 'text-sky-700',
    }
  }

  return {
    icon: QrCodeIcon,
    title: 'Pix',
    description: 'Ao registrar, geramos um codigo Pix interno para conferencia do pedido.',
    status: 'Codigo gerado no fechamento',
    borderClass: 'border-emerald-200',
    iconClass: 'bg-emerald-50 text-emerald-700',
    statusClass: 'text-emerald-700',
  }
})

const installmentOptions = computed(() =>
  buildCardInstallmentOptions(props.total, props.paymentGateway)
)

const paymentLinkStatus = computed(() => {
  if (props.customer.paymentMethod === 'card') {
    return props.paymentGateway.is_card_link_configured
      ? 'Link de cartao sera enviado junto com a referencia do pedido.'
      : 'Cartao sem link configurado: combine a cobranca no atendimento.'
  }

  return props.paymentGateway.is_pix_link_configured
    ? 'Link Pix sera enviado junto com a referencia do pedido.'
    : 'Pix sem link configurado: use a referencia interna para conferencia.'
})

const deliveryRegionPlaceholder = computed(() => {
  if (props.isDeliveryRegionsLoading) {
    return 'Carregando regioes...'
  }

  return props.deliveryRegions.length > 0 ? 'Selecione uma regiao' : 'Combinar entrega com a loja'
})

const checkoutValidationMessage = computed(() => {
  if (props.itemCount === 0) {
    return 'Adicione ao menos um item ao pedido.'
  }

  if (!hasProfileIdentity.value) {
    return 'Crie seu perfil para finalizar o pedido.'
  }

  if (!hasCompleteProfileAddress.value) {
    return 'Complete o endereco no seu perfil para finalizar.'
  }

  if (props.isDeliveryRegionsLoading) {
    return 'Carregando regioes...'
  }

  if (props.deliveryRegions.length > 0 && !props.customer.deliveryRegionId) {
    return 'Selecione a regiao.'
  }

  return ''
})

const canSubmitCheckout = computed(() => props.itemCount > 0 && !props.isSubmitting && !checkoutValidationMessage.value)

const submitButtonLabel = computed(() => {
  if (props.isSubmitting) {
    return 'Registrando pedido...'
  }

  return props.isWhatsAppConfigured ? 'Registrar e abrir WhatsApp' : 'Registrar pedido'
})

function getInputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function handleNotesInput(event: Event): void {
  emit('updateCustomer', {
    notes: getInputValue(event),
  })
}

function handlePaymentMethodChange(event: Event): void {
  emit('updateCustomer', {
    paymentMethod: getInputValue(event) as CartCustomer['paymentMethod'],
    paymentInstallments: 1,
  })
}

function handlePaymentInstallmentsChange(event: Event): void {
  emit('updateCustomer', {
    paymentInstallments: Number(getInputValue(event)),
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
aside input,
aside select {
  min-height: 3rem;
  border-radius: 0.75rem;
  padding-inline: 0.875rem;
}

aside textarea {
  border-radius: 0.75rem;
  padding: 0.625rem 0.875rem;
}

@media (max-height: 640px) {
  .cart-summary-footer {
    padding-block: 0.75rem;
  }

  .cart-summary-list {
    gap: 0.375rem;
  }

  .cart-summary-row {
    display: none;
  }

  .cart-total-row {
    border-top: 0;
    padding-top: 0;
  }

  .cart-total-row span:last-child {
    font-size: 1.125rem;
  }

  .cart-summary-note {
    display: none;
  }

  .cart-summary-alert {
    padding-block: 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.35;
  }

  .cart-summary-cta {
    margin-top: 0.625rem;
    min-height: 2.625rem;
    padding-block: 0.5rem;
  }
}

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
