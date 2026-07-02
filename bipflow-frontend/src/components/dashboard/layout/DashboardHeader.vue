<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  QrCodeIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { buildStoreBranding } from '@/composables/useStoreBranding';
import { DashboardRoutes } from '@/router/dashboard.routes';
import type { Store } from '@/types/store';

const props = withDefaults(defineProps<{
  userName: string | null
  stores?: Store[]
  selectedStore?: Store | null
  isStoreLoading?: boolean
  storefrontPath?: string
}>(), {
  stores: () => [],
  selectedStore: null,
  isStoreLoading: false,
  storefrontPath: '/produtos',
});

const emit = defineEmits<{
  selectStore: [storeSlug: string]
  openStore: []
  logout: []
}>();

const NAV_ITEMS = [
  { label: 'Visao geral', to: { name: DashboardRoutes.Overview }, icon: ChartBarIcon },
  { label: 'Produtos', to: { name: DashboardRoutes.Products }, icon: ShoppingBagIcon },
  { label: 'PDV', to: { name: DashboardRoutes.Pdv }, icon: QrCodeIcon },
  { label: 'Pedidos', to: { name: DashboardRoutes.Orders }, icon: ReceiptPercentIcon },
  { label: 'Atendimento', to: { name: DashboardRoutes.Support }, icon: ChatBubbleLeftRightIcon },
  { label: 'Configuracoes', to: { name: DashboardRoutes.Settings }, icon: Cog6ToothIcon },
];

const isMobileNavOpen = ref(false);

const welcomeMessage = computed(() => (
  props.userName ? `Bem-vindo, ${props.userName}` : 'Bem-vindo'
));

const activeBranding = computed(() => buildStoreBranding(props.selectedStore));
const activeStoreSlug = computed(() => activeBranding.value.slug);
const activeStorePathSlug = computed(() => (
  activeStoreSlug.value ? `/${activeStoreSlug.value}` : ''
));

function handleStoreSelect(event: Event): void {
  const storeSlug = (event.target as HTMLSelectElement).value;
  emit('selectStore', storeSlug);
}

function closeMobileNav(): void {
  isMobileNavOpen.value = false;
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-bip-line bg-white/95 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
      <div class="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-24 shrink-0 items-center justify-center overflow-hidden">
              <img
                :src="activeBranding.logoUrl"
                :alt="activeBranding.name"
                class="h-full w-full object-contain"
              />
            </div>
            <div class="flex flex-col">
              <span class="brand-wordmark brand-wordmark-premium max-w-[18rem] truncate text-base">
                {{ activeBranding.name }}
              </span>
              <span class="text-3xs font-bold uppercase tracking-widest text-bip-rose">
                {{ activeBranding.tagline }}
              </span>
            </div>
          </div>

          <div class="hidden md:block h-6 border-l border-bip-line mx-1"></div>

          <span class="inline-flex max-w-full items-center gap-2 rounded-full border border-success-border bg-success-soft px-2.5 py-0.5 text-2xs font-black uppercase tracking-widest text-success">
            <span class="h-1.5 w-1.5 rounded-full bg-success" />
            <span class="truncate">Loja {{ activeBranding.statusLabel.toLowerCase() }} {{ activeStorePathSlug }}</span>
          </span>
        </div>

        <div class="flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
          <label class="relative min-w-0 sm:w-52">
            <span class="sr-only">Selecionar loja ativa</span>
            <select
              :value="activeStoreSlug"
              :disabled="isStoreLoading || stores.length === 0"
              class="h-9 w-full appearance-none rounded-xl border border-[#D1D5DB] bg-white px-3 pr-9 text-sm font-semibold text-bip-black outline-none transition hover:border-bip-rose/50 focus:border-bip-rose focus:ring-2 focus:ring-bip-blush disabled:cursor-not-allowed disabled:opacity-60"
              @change="handleStoreSelect"
            >
              <option value="" disabled>
                {{ isStoreLoading ? 'Carregando loja...' : 'Selecione a loja' }}
              </option>
              <option
                v-for="store in stores"
                :key="store.id"
                :value="store.slug"
              >
                {{ store.name }}
              </option>
            </select>
          </label>

          <a
            :href="storefrontPath"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-bip-line bg-white px-3.5 text-xs font-black uppercase tracking-widest text-bip-muted transition hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
            :title="`Abrir ${storefrontPath}`"
            @click="emit('openStore')"
          >
            <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            Ver vitrine
          </a>

          <div class="flex min-w-0 flex-col items-end">
            <span class="hidden text-3xs font-black uppercase tracking-[0.2em] text-bip-muted sm:block">
              Operador
            </span>
            <span class="max-w-[8rem] truncate text-xs font-bold text-bip-black sm:max-w-[13rem] sm:text-sm">
              {{ welcomeMessage }}
            </span>
          </div>

          <button
            type="button"
            class="hidden h-11 w-11 items-center justify-center rounded-xl border border-bip-line bg-white text-bip-muted transition-all duration-300 hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush lg:flex"
            aria-label="Finalizar sessao"
            title="Finalizar sessao"
            @click="emit('logout')"
          >
            <ArrowLeftOnRectangleIcon class="h-5 w-5" />
          </button>

          <button
            type="button"
            class="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-bip-line bg-white text-bip-muted transition-all duration-300 hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush lg:hidden"
            :aria-expanded="isMobileNavOpen"
            aria-label="Abrir menu de navegacao"
            @click="isMobileNavOpen = !isMobileNavOpen"
          >
            <Bars3Icon v-if="!isMobileNavOpen" class="h-5 w-5 transition-transform group-hover:scale-110" />
            <XMarkIcon v-else class="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Secoes do dashboard" class="mt-2.5 hidden items-center gap-1 lg:flex">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.label"
          :to="item.to"
          class="flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-black uppercase tracking-widest text-bip-muted transition hover:bg-bip-blush/60 hover:text-bip-black"
          active-class="bg-bip-blush text-bip-rose"
          exact-active-class="bg-bip-blush text-bip-rose"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>

    <Transition name="mobile-nav">
      <nav
        v-if="isMobileNavOpen"
        aria-label="Secoes do dashboard (mobile)"
        class="border-t border-bip-line bg-white px-6 py-4 lg:hidden"
      >
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.label"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#05050A] transition hover:bg-[#FCE7F3]/60"
          active-class="bg-[#FCE7F3] text-[#D81B60]"
          exact-active-class="bg-[#FCE7F3] text-[#D81B60]"
          @click="closeMobileNav"
        >
          <component :is="item.icon" class="h-5 w-5" />
          {{ item.label }}
        </RouterLink>

        <button
          type="button"
          class="mt-2 flex w-full items-center gap-3 rounded-xl border border-[#D81B60]/20 bg-[#FCE7F3] px-3 py-3 text-sm font-bold text-[#D81B60] transition hover:bg-[#FCE7F3]/70"
          @click="emit('logout')"
        >
          <ArrowLeftOnRectangleIcon class="h-5 w-5" />
          Finalizar sessao
        </button>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.mobile-nav-enter-active,
.mobile-nav-leave-active {
  transition: opacity 0.16s ease;
}

.mobile-nav-enter-from,
.mobile-nav-leave-to {
  opacity: 0;
}
</style>
