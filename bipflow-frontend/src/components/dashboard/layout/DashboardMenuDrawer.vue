<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PhoneIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { Product } from '@/schemas/product.schema'
import type { DeliveryRegion, DeliveryRegionPayload } from '@/types/delivery'
import type { SaleOrder } from '@/types/sales'
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings'
import { formatBRL } from '@/utils/formatters'

const props = defineProps<{
  isOpen: boolean
  recentSales: SaleOrder[]
  isSalesLoading: boolean
  salesError: string | null
  deliveryRegions: DeliveryRegion[]
  isDeliveryRegionsLoading: boolean
  deliveryRegionsError: string | null
  isSavingDeliveryRegion: boolean
  deletingDeliveryRegionId: number | null
  storeSettings: StoreSettings | null
  isStoreSettingsLoading: boolean
  storeSettingsError: string | null
  isSavingStoreSettings: boolean
  outOfStockProducts: Product[]
  lowStockProducts: Product[]
}>()

const emit = defineEmits<{
  close: []
  logout: []
  createProduct: []
  focusProducts: []
  focusBot: []
  openStore: []
  saveDeliveryRegion: [payload: DeliveryRegionPayload, id?: number]
  deleteDeliveryRegion: [id: number]
  saveStoreSettings: [payload: StoreSettingsPayload]
}>()

const activeView = ref<'overview' | 'delivery' | 'store'>('overview')
const editingRegionId = ref<number | null>(null)
const regionDraft = ref<DeliveryRegionPayload>({
  name: '',
  city: '',
  neighborhoods: '',
  delivery_fee: '',
  is_active: true,
})
const storeSettingsDraft = ref<StoreSettingsPayload>({
  whatsapp_phone: '',
})

const storeWhatsappDigits = computed(() => normalizePhone(storeSettingsDraft.value.whatsapp_phone))
const storeWhatsappValidationMessage = computed(() => {
  if (!storeSettingsDraft.value.whatsapp_phone.trim()) {
    return ''
  }

  if (storeWhatsappDigits.value.length < 10 || storeWhatsappDigits.value.length > 15) {
    return 'Use codigo do pais e DDD. Ex.: 5571999999999'
  }

  return ''
})
const storeWhatsappTestUrl = computed(() => (
  props.storeSettings?.whatsapp_phone_digits
    ? `https://wa.me/${props.storeSettings.whatsapp_phone_digits}`
    : ''
))
const canSaveStoreSettings = computed(() => (
  !props.isSavingStoreSettings
  && !props.isStoreSettingsLoading
  && !storeWhatsappValidationMessage.value
))

watch(
  () => props.storeSettings?.whatsapp_phone,
  (phone) => {
    storeSettingsDraft.value = {
      whatsapp_phone: phone ?? '',
    }
  },
  { immediate: true }
)

function resetRegionDraft(): void {
  editingRegionId.value = null
  regionDraft.value = {
    name: '',
    city: '',
    neighborhoods: '',
    delivery_fee: '',
    is_active: true,
  }
}

function openDeliveryPricing(): void {
  activeView.value = 'delivery'
}

function openStoreSettings(): void {
  activeView.value = 'store'
  resetRegionDraft()
}

function openOverview(): void {
  activeView.value = 'overview'
  resetRegionDraft()
}

function editDeliveryRegion(region: DeliveryRegion): void {
  activeView.value = 'delivery'
  editingRegionId.value = region.id
  regionDraft.value = {
    name: region.name,
    city: region.city,
    neighborhoods: region.neighborhoods,
    delivery_fee: String(region.delivery_fee),
    is_active: region.is_active,
  }
}

function submitDeliveryRegion(): void {
  const deliveryFee = Number(regionDraft.value.delivery_fee)

  if (!regionDraft.value.name.trim() || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
    return
  }

  emit(
    'saveDeliveryRegion',
    {
      name: regionDraft.value.name.trim(),
      city: regionDraft.value.city.trim(),
      neighborhoods: regionDraft.value.neighborhoods.trim(),
      delivery_fee: deliveryFee.toFixed(2),
      is_active: regionDraft.value.is_active,
    },
    editingRegionId.value ?? undefined
  )
  resetRegionDraft()
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function submitStoreSettings(): void {
  if (!canSaveStoreSettings.value) {
    return
  }

  emit('saveStoreSettings', {
    whatsapp_phone: storeWhatsappDigits.value,
  })
}

function getStockValue(product: Product): number {
  return Number(product.stock_quantity ?? 0)
}

function formatSaleDate(dateString: string): string {
  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponivel'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getPaymentLabel(paymentMethod: SaleOrder['payment_method']): string {
  const labels: Record<SaleOrder['payment_method'], string> = {
    pix: 'Pix',
    card: 'Cartao',
    cash: 'Dinheiro',
  }

  return labels[paymentMethod]
}
</script>

<template>
  <Transition name="dashboard-menu">
    <div v-if="isOpen" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')" />

      <aside class="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-white/10 bg-zinc-950 shadow-2xl">
        <header class="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
              Centro de operacao
            </p>
            <h2 class="mt-2 text-xl font-black tracking-tight text-white">
              Menu BipFlow
            </h2>
          </div>

          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-white/20 hover:text-white"
            aria-label="Fechar menu do dashboard"
            @click="$emit('close')"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          <section class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/15"
              @click="$emit('createProduct')"
            >
              <PlusIcon class="h-5 w-5 text-indigo-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Novo produto
              </span>
            </button>

            <button
              type="button"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
              @click="$emit('focusProducts')"
            >
              <ShoppingBagIcon class="h-5 w-5 text-zinc-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Produtos
              </span>
            </button>

            <button
              type="button"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-rose-400/40 hover:bg-rose-500/10"
              @click="$emit('focusBot')"
            >
              <ChatBubbleLeftRightIcon class="h-5 w-5 text-rose-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Bot
              </span>
            </button>

            <button
              type="button"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
              @click="$emit('openStore')"
            >
              <ArrowTopRightOnSquareIcon class="h-5 w-5 text-zinc-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Vitrine
              </span>
            </button>

            <button
              type="button"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/10"
              @click="openDeliveryPricing"
            >
              <TruckIcon class="h-5 w-5 text-indigo-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Frete
              </span>
            </button>

            <button
              type="button"
              class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
              @click="openStoreSettings"
            >
              <PhoneIcon class="h-5 w-5 text-emerald-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                WhatsApp
              </span>
            </button>

            <div class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <ExclamationTriangleIcon class="h-5 w-5 text-amber-300" />
              <span class="mt-4 block text-xs font-black uppercase tracking-widest text-white">
                Estoque
              </span>
            </div>
          </section>

          <template v-if="activeView === 'overview'">
          <section class="mt-8">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Vendas
                </p>
                <h3 class="mt-1 text-sm font-black uppercase tracking-widest text-white">
                  Historico recente
                </h3>
              </div>
              <ChartBarIcon class="h-5 w-5 text-emerald-300" />
            </div>

            <div class="mt-4 space-y-3">
              <div v-if="isSalesLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div class="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                <div class="mt-3 h-3 w-48 animate-pulse rounded bg-zinc-800" />
              </div>

              <div v-else-if="salesError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                {{ salesError }}
              </div>

              <div v-else-if="recentSales.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p class="text-sm font-semibold text-white">
                  Nenhuma venda registrada ainda.
                </p>
                <p class="mt-1 text-xs leading-5 text-zinc-500">
                  Os pedidos finalizados pela vitrine aparecem aqui automaticamente.
                </p>
              </div>

              <template v-else>
                <article
                  v-for="sale in recentSales"
                  :key="sale.id"
                  class="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-bold text-white">
                        {{ sale.customer_name }}
                      </p>
                      <p class="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <ClockIcon class="h-3.5 w-3.5" />
                        {{ formatSaleDate(sale.created_at) }} - {{ getPaymentLabel(sale.payment_method) }}
                      </p>
                    </div>
                    <p class="shrink-0 text-sm font-black text-emerald-300">
                      {{ formatBRL(sale.total) }}
                    </p>
                  </div>

                  <p class="mt-3 text-xs text-zinc-500">
                    {{ sale.item_count }} item<span v-if="sale.item_count !== 1">s</span> - {{ sale.order_reference }}
                  </p>
                </article>
              </template>
            </div>
          </section>

          <section class="mt-8">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Inventario
                </p>
                <h3 class="mt-1 text-sm font-black uppercase tracking-widest text-white">
                  Produtos em atencao
                </h3>
              </div>
              <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                {{ outOfStockProducts.length + lowStockProducts.length }}
              </span>
            </div>

            <div class="mt-4 space-y-3">
              <div
                v-if="outOfStockProducts.length === 0 && lowStockProducts.length === 0"
                class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200"
              >
                Estoque sem rupturas no momento.
              </div>

              <article
                v-for="product in outOfStockProducts"
                :key="`out-${product.id ?? product.name}`"
                class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4"
              >
                <div class="flex items-center justify-between gap-4">
                  <p class="min-w-0 truncate text-sm font-bold text-white">
                    {{ product.name }}
                  </p>
                  <span class="shrink-0 text-xs font-black uppercase tracking-widest text-rose-200">
                    zerado
                  </span>
                </div>
              </article>

              <article
                v-for="product in lowStockProducts"
                :key="`low-${product.id ?? product.name}`"
                class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
              >
                <div class="flex items-center justify-between gap-4">
                  <p class="min-w-0 truncate text-sm font-bold text-white">
                    {{ product.name }}
                  </p>
                  <span class="shrink-0 text-xs font-black uppercase tracking-widest text-amber-200">
                    {{ getStockValue(product) }} un.
                  </span>
                </div>
              </article>
            </div>
          </section>
          </template>

          <section v-else-if="activeView === 'delivery'" class="mt-8">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Operacao
                </p>
                <h3 class="mt-1 text-sm font-black uppercase tracking-widest text-white">
                  Frete por regiao
                </h3>
              </div>
              <button
                type="button"
                class="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition hover:border-white/20 hover:text-white"
                @click="openOverview"
              >
                Voltar
              </button>
            </div>

            <form class="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitDeliveryRegion">
              <label class="block">
                <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Regiao</span>
                <input
                  v-model="regionDraft.name"
                  type="text"
                  class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  placeholder="Centro, Zona Norte..."
                />
              </label>

              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <label class="block">
                  <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Cidade</span>
                  <input
                    v-model="regionDraft.city"
                    type="text"
                    class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                    placeholder="Salvador"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor</span>
                  <input
                    v-model="regionDraft.delivery_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                    placeholder="12.00"
                  />
                </label>
              </div>

              <label class="block">
                <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Bairros atendidos</span>
                <textarea
                  v-model="regionDraft.neighborhoods"
                  rows="3"
                  class="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  placeholder="Opcional: Centro, Barra, Ondina"
                />
              </label>

              <label class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2">
                <span class="text-xs font-bold text-zinc-300">Regiao ativa na vitrine</span>
                <input
                  v-model="regionDraft.is_active"
                  type="checkbox"
                  class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30"
                />
              </label>

              <button
                type="submit"
                :disabled="isSavingDeliveryRegion"
                class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {{ isSavingDeliveryRegion ? 'Salvando...' : editingRegionId ? 'Salvar regiao' : 'Adicionar regiao' }}
              </button>
            </form>

            <div class="mt-5 space-y-3">
              <div v-if="isDeliveryRegionsLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div class="h-4 w-40 animate-pulse rounded bg-zinc-800" />
                <div class="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-800" />
              </div>

              <div v-else-if="deliveryRegionsError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                {{ deliveryRegionsError }}
              </div>

              <div v-else-if="deliveryRegions.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p class="text-sm font-semibold text-white">Nenhuma regiao cadastrada.</p>
                <p class="mt-1 text-xs leading-5 text-zinc-500">
                  Cadastre regioes para precificar o frete no carrinho publico.
                </p>
              </div>

              <template v-else>
                <article
                  v-for="region in deliveryRegions"
                  :key="region.id"
                  class="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-bold text-white">{{ region.name }}</p>
                      <p class="mt-1 text-xs text-zinc-500">
                        {{ region.city || 'Cidade nao informada' }} - {{ region.is_active ? 'Ativa' : 'Inativa' }}
                      </p>
                    </div>
                    <p class="shrink-0 text-sm font-black text-indigo-300">
                      {{ formatBRL(region.delivery_fee) }}
                    </p>
                  </div>

                  <p v-if="region.neighborhoods" class="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                    {{ region.neighborhoods }}
                  </p>

                  <div class="mt-4 flex gap-2">
                    <button
                      type="button"
                      class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-white/20 hover:text-white"
                      @click="editDeliveryRegion(region)"
                    >
                      <PencilSquareIcon class="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="deletingDeliveryRegionId === region.id"
                      @click="$emit('deleteDeliveryRegion', region.id)"
                    >
                      <TrashIcon class="h-4 w-4" />
                      {{ deletingDeliveryRegionId === region.id ? 'Removendo' : 'Remover' }}
                    </button>
                  </div>
                </article>
              </template>
            </div>
          </section>

          <section v-else class="mt-8">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Loja
                </p>
                <h3 class="mt-1 text-sm font-black uppercase tracking-widest text-white">
                  WhatsApp de pedidos
                </h3>
              </div>
              <button
                type="button"
                class="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition hover:border-white/20 hover:text-white"
                @click="openOverview"
              >
                Voltar
              </button>
            </div>

            <div v-if="isStoreSettingsLoading" class="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div class="h-4 w-44 animate-pulse rounded bg-zinc-800" />
              <div class="mt-3 h-3 w-64 animate-pulse rounded bg-zinc-800" />
            </div>

            <div v-else-if="storeSettingsError" class="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {{ storeSettingsError }}
            </div>

            <form class="mt-4 space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitStoreSettings">
              <label class="block">
                <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Numero da loja</span>
                <input
                  v-model="storeSettingsDraft.whatsapp_phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  placeholder="+55 71 99999-9999"
                />
              </label>

              <p v-if="storeWhatsappValidationMessage" class="text-xs font-semibold text-amber-200">
                {{ storeWhatsappValidationMessage }}
              </p>

              <div class="rounded-lg border border-white/10 bg-zinc-950 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Destino atual
                </p>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <p class="min-w-0 truncate text-sm font-bold text-white">
                    {{ storeSettings?.is_whatsapp_configured ? storeSettings.whatsapp_phone_digits : 'Nao configurado' }}
                  </p>
                  <a
                    v-if="storeWhatsappTestUrl"
                    :href="storeWhatsappTestUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400/15"
                    aria-label="Abrir WhatsApp configurado"
                  >
                    <ArrowTopRightOnSquareIcon class="h-4 w-4" />
                  </a>
                </div>
              </div>

              <button
                type="submit"
                :disabled="!canSaveStoreSettings"
                class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {{ isSavingStoreSettings ? 'Salvando...' : 'Salvar WhatsApp' }}
              </button>
            </form>
          </section>
        </div>

        <footer class="border-t border-white/10 p-6">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left transition hover:border-rose-400/40 hover:bg-rose-500/15"
            @click="$emit('logout')"
          >
            <span>
              <span class="block text-xs font-black uppercase tracking-widest text-rose-100">
                Finalizar sessao
              </span>
              <span class="mt-1 block text-[11px] font-semibold text-rose-300/80">
                Encerrar acesso administrativo
              </span>
            </span>
            <ArrowLeftOnRectangleIcon class="h-5 w-5 text-rose-200" />
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.dashboard-menu-enter-active,
.dashboard-menu-leave-active {
  transition: opacity 0.2s ease;
}

.dashboard-menu-enter-active aside,
.dashboard-menu-leave-active aside {
  transition: transform 0.24s ease;
}

.dashboard-menu-enter-from,
.dashboard-menu-leave-to {
  opacity: 0;
}

.dashboard-menu-enter-from aside,
.dashboard-menu-leave-to aside {
  transform: translateX(24px);
}
</style>
