<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      ref="containerRef"
      class="intro-splash fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-5 px-6 text-center"
      role="dialog"
      aria-modal="true"
      :aria-label="fullText"
      tabindex="-1"
      @click="$emit('dismiss')"
    >
      <div>
        <p class="intro-typewriter brand-wordmark brand-wordmark-premium text-2xl font-semibold sm:text-4xl">
          <span>{{ typedText }}</span><span class="intro-caret" aria-hidden="true"></span>
        </p>

        <Transition
          enter-active-class="transition duration-500 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
        >
          <p v-if="isTypingDone" class="intro-tagline mt-2 text-sm">{{ taglineText }}</p>
        </Transition>
      </div>

      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-300 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div v-if="showLoadingState" class="flex flex-col items-center gap-3" aria-live="polite">
          <span class="intro-spinner h-8 w-8 rounded-full" />
          <p class="intro-loading-text text-sm">Aguarde, o site esta iniciando...</p>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  visible: boolean
  /** Reflects the storefront's real initial data fetch, not a fixed guess -- see ProductsView.vue. */
  isBackendReady: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()

const containerRef = ref<HTMLElement | null>(null)
const fullText = 'Seja bem-vindo a Boutique Fitness'
const taglineText = 'Catalogo online'
const typedText = ref('')
const isTypingDone = ref(false)
const showLoadingState = computed(() => isTypingDone.value && !props.isBackendReady)

useDialogA11y(
  computed(() => props.visible),
  () => emit('dismiss'),
  containerRef
)

const CHAR_DELAY_MS = 55
const READ_PAUSE_MS = 1200
// Cold-start safety net: a free-tier backend can take a while to wake up, but
// the visitor must never be stranded behind a spinner forever -- fall back to
// the storefront's own "Erro ao carregar produtos" / retry UI past this point.
const MAX_BACKEND_WAIT_MS = 20000

let typingTimer: ReturnType<typeof setInterval> | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let backendWaitTimer: ReturnType<typeof setTimeout> | null = null

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function clearAllTimers(): void {
  if (typingTimer !== null) {
    clearInterval(typingTimer)
    typingTimer = null
  }
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (backendWaitTimer !== null) {
    clearTimeout(backendWaitTimer)
    backendWaitTimer = null
  }
}

function scheduleDismiss(delayMs: number): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
  }
  dismissTimer = setTimeout(() => emit('dismiss'), delayMs)
}

function handleTypingFinished(): void {
  isTypingDone.value = true

  if (props.isBackendReady) {
    scheduleDismiss(READ_PAUSE_MS)
    return
  }

  backendWaitTimer = setTimeout(() => emit('dismiss'), MAX_BACKEND_WAIT_MS)
}

function startTyping(): void {
  clearAllTimers()
  typedText.value = ''
  isTypingDone.value = false

  if (prefersReducedMotion()) {
    typedText.value = fullText
    handleTypingFinished()
    return
  }

  let charIndex = 0
  typingTimer = setInterval(() => {
    charIndex += 1
    typedText.value = fullText.slice(0, charIndex)

    if (charIndex >= fullText.length) {
      clearInterval(typingTimer!)
      typingTimer = null
      handleTypingFinished()
    }
  }, CHAR_DELAY_MS)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      startTyping()
    } else {
      clearAllTimers()
    }
  },
  { immediate: true }
)

watch(
  () => props.isBackendReady,
  (ready) => {
    if (!ready || !isTypingDone.value) {
      return
    }

    if (backendWaitTimer !== null) {
      clearTimeout(backendWaitTimer)
      backendWaitTimer = null
    }
    scheduleDismiss(READ_PAUSE_MS)
  }
)

onBeforeUnmount(clearAllTimers)
</script>

<style scoped>
.intro-splash {
  background: #ffffff;
  color: var(--store-text, #05050a);
}

.intro-typewriter {
  display: inline-flex;
  align-items: baseline;
  /* .brand-wordmark-premium clips its gradient to this element's own box.
     Since that box widens character by character as the typewriter reveals
     text, the visible slice of the gradient shifts from dark towards the
     store accent color along with the typing -- no separate animation
     needed for the color transition to track the reveal. */
}

.intro-caret {
  display: inline-block;
  width: 0.09em;
  margin-left: 0.15em;
  height: 1em;
  /* Matches brand-wordmark-premium's gradient endpoint exactly (not
     var(--store-accent)) -- that gradient is a fixed brand treatment, not
     store-themed, so the caret must track its literal color to stay aligned. */
  background: #d81b60;
  animation: intro-caret-blink 0.75s step-end infinite;
}

.intro-spinner {
  /* Conic-gradient ring (mask cuts out the center) instead of a flat
     two-tone border-spin -- echoes the wordmark's dark-to-accent sweep so
     the loading state reads as the same piece of craft as the name. */
  background: conic-gradient(from 0deg, transparent 0deg, #05050a 120deg, #d81b60 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  animation: intro-spinner-spin 0.9s linear infinite;
}

@keyframes intro-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

.intro-loading-text {
  color: var(--store-muted, #6b7280);
}

.intro-tagline {
  color: var(--store-muted, #6b7280);
}

@keyframes intro-caret-blink {
  from,
  to {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}
</style>
