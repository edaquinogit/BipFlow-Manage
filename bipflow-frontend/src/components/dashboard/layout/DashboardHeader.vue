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
import DashboardStoreSelect from './DashboardStoreSelect.vue';
import DashboardHeaderBranding from './DashboardHeaderBranding.vue';
import DashboardMobileNav from './DashboardMobileNav.vue';

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

const welcomeMessage = computed(() => {
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return props.userName ? `${greeting}, ${props.userName}! O que vamos pedir hoje?` : `${greeting}! O que vamos pedir hoje?`;
});

const activeBranding = computed(() => buildStoreBranding(props.selectedStore));

function closeMobileNav(): void {
  isMobileNavOpen.value = false;
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-bip-line bg-white/95 shadow-[0_8px_30px_-24px_rgba(5,5,10,0.35)] backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
          <DashboardHeaderBranding :branding="activeBranding" />

        </div>

        <div class="flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
          <DashboardStoreSelect
            :stores="stores"
            :selected-store="selectedStore"
            :is-store-loading="isStoreLoading"
            @select-store="emit('selectStore', $event)"
          />

          <a
            :href="storefrontPath"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-bip-rose/20 bg-bip-blush/60 px-3.5 text-[clamp(0.7rem,0.65rem+0.2vw,0.8rem)] font-black uppercase tracking-[0.16em] text-bip-rose transition-all duration-200 hover:-translate-y-0.5 hover:border-bip-rose/40 hover:bg-bip-blush focus:outline-none focus:ring-2 focus:ring-bip-blush active:translate-y-0"
            :title="`Abrir ${storefrontPath}`"
            @click="emit('openStore')"
          >
            <ArrowTopRightOnSquareIcon class="h-4 w-4" />
            Ver vitrine
          </a>

          <div class="flex min-w-0 flex-col items-end rounded-xl border border-bip-line bg-bip-soft/60 px-3.5 py-1.5">
            <span class="hidden text-3xs font-black uppercase tracking-[0.24em] text-bip-muted sm:block">
              Operador
            </span>
            <span class="max-w-[8rem] truncate text-[clamp(0.75rem,0.7rem+0.25vw,0.95rem)] font-semibold leading-tight text-bip-black sm:max-w-[13rem]">
              {{ welcomeMessage }}
            </span>
          </div>

          <button
            type="button"
            class="hidden h-11 w-11 items-center justify-center rounded-xl border border-bip-line bg-white text-bip-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush active:scale-[0.98] lg:flex"
            aria-label="Finalizar sessao"
            title="Finalizar sessao"
            @click="emit('logout')"
          >
            <ArrowLeftOnRectangleIcon class="h-5 w-5" />
          </button>

          <button
            type="button"
            class="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-bip-line bg-white text-bip-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush active:scale-[0.98] lg:hidden"
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

    <DashboardMobileNav
      :items="NAV_ITEMS"
      :is-open="isMobileNavOpen"
      @close="closeMobileNav"
      @logout="emit('logout')"
    />
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
