<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
} from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { buildPublicStorefrontUrl, isValidPublicStorefrontUrl } from '@/utils/publicStorefrontUrl';

const props = defineProps<{
  storefrontPath: string
}>();

const toast = useToast();

const isOpen = ref(false);
const isCopied = ref(false);
const containerRef = ref<HTMLElement | null>(null);
let copiedFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

const absoluteStorefrontUrl = computed(() => buildPublicStorefrontUrl(props.storefrontPath, {
  runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
}));

const hasValidStorefrontUrl = computed(() => (
  Boolean(absoluteStorefrontUrl.value && isValidPublicStorefrontUrl(absoluteStorefrontUrl.value))
));

function toggleMenu(): void {
  isOpen.value = !isOpen.value;
}

function closeMenu(): void {
  isOpen.value = false;
}

function handleOutsideClick(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) {
    closeMenu();
  }
}

function clearCopiedFeedback(): void {
  if (copiedFeedbackTimeout) {
    clearTimeout(copiedFeedbackTimeout);
    copiedFeedbackTimeout = null;
  }

  isCopied.value = false;
}

function showCopiedFeedback(): void {
  clearCopiedFeedback();
  isCopied.value = true;
  copiedFeedbackTimeout = setTimeout(() => {
    isCopied.value = false;
    copiedFeedbackTimeout = null;
  }, 2200);
}

async function copyStorefrontLink(): Promise<void> {
  if (!hasValidStorefrontUrl.value || !absoluteStorefrontUrl.value) {
    toast.error('Link da vitrine invalido. Revise a configuracao da URL publica.');
    return;
  }

  if (!navigator.clipboard?.writeText) {
    toast.error('Nao foi possivel copiar o link.');
    return;
  }

  try {
    await navigator.clipboard.writeText(absoluteStorefrontUrl.value);
    showCopiedFeedback();
    toast.success('Link da vitrine copiado.');
  } catch (error) {
    Logger.warn('Failed to copy storefront link', {
      url: absoluteStorefrontUrl.value,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    toast.error('Nao foi possivel copiar o link.');
  }
}

function openStorefrontLink(event: MouseEvent): void {
  if (!hasValidStorefrontUrl.value || !absoluteStorefrontUrl.value) {
    event.preventDefault();
    toast.error('Link da vitrine invalido. Revise a configuracao da URL publica.');
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleOutsideClick);
  window.removeEventListener('keydown', handleKeydown);
  clearCopiedFeedback();
});
</script>

<template>
  <div ref="containerRef" class="relative self-start sm:self-auto">
    <button
      type="button"
      class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-bip-rose/20 bg-bip-blush/60 px-3.5 text-[clamp(0.7rem,0.65rem+0.2vw,0.8rem)] font-black uppercase tracking-[0.16em] text-bip-rose transition-all duration-200 hover:-translate-y-0.5 hover:border-bip-rose/40 hover:bg-bip-blush focus:outline-none focus:ring-2 focus:ring-bip-blush active:translate-y-0 active:scale-[0.98] lg:h-10 lg:px-3"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      title="Ver vitrine"
      @click="toggleMenu"
    >
      <ArrowTopRightOnSquareIcon class="h-4 w-4" />
      Ver vitrine
    </button>

    <div
      v-if="isOpen"
      role="dialog"
      aria-label="Compartilhar vitrine"
      class="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-bip-line bg-white shadow-lg sm:left-auto sm:right-0"
    >
      <div class="p-3">
        <p class="text-3xs font-black uppercase tracking-[0.2em] text-bip-muted">
          Link da vitrine
        </p>
        <div class="mt-1.5 flex items-center gap-2">
          <input
            readonly
            :value="absoluteStorefrontUrl || ''"
            class="min-w-0 flex-1 truncate rounded-lg border border-bip-line bg-bip-blush/20 px-2 py-1.5 text-xs text-bip-black outline-none focus:border-bip-rose"
            @click="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bip-line bg-white text-bip-muted transition hover:border-bip-rose/40 hover:text-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush active:scale-[0.98]"
            :title="isCopied ? 'Copiado' : 'Copiar link'"
            :aria-label="isCopied ? 'Link copiado' : 'Copiar link da vitrine'"
            @click="copyStorefrontLink"
          >
            <ClipboardDocumentCheckIcon v-if="isCopied" class="h-4 w-4 text-bip-rose" />
            <ClipboardDocumentIcon v-else class="h-4 w-4" />
          </button>
        </div>
      </div>

      <a
        :href="absoluteStorefrontUrl || '#'"
        target="_blank"
        rel="noopener noreferrer"
        class="flex min-h-11 items-center justify-center gap-2 border-t border-bip-line bg-bip-blush/40 px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-bip-rose transition hover:bg-bip-blush active:scale-[0.98]"
        @click="(event) => { openStorefrontLink(event); closeMenu(); }"
      >
        <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        Entrar na vitrine
      </a>
    </div>
  </div>
</template>
