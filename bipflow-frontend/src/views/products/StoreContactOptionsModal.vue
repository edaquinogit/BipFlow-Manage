<template>
  <Teleport to="body">
    <Transition name="contact-options">
      <div
        v-if="isOpen && isConfigured"
        class="fixed inset-0 z-50 bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-contact-options-title"
        @click.self="$emit('close')"
      >
        <section
          class="mx-auto w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.55)] sm:p-5"
        >
          <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                Atendimento WhatsApp
              </p>
              <h2 id="store-contact-options-title" class="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Escolha sua duvida
              </h2>
              <p class="mt-1 text-sm leading-6 text-slate-600">
                {{ formattedPhone }}
              </p>
            </div>

            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
              aria-label="Fechar opcoes de atendimento"
              @click="$emit('close')"
            >
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div class="mt-4 grid gap-2">
            <button
              v-for="option in contactOptions"
              :key="option.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-rose-200 hover:bg-rose-50/60 focus:outline-none focus:ring-2 focus:ring-rose-200"
              @click="openWhatsApp(option)"
            >
              <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                <component :is="option.icon" class="h-5 w-5" aria-hidden="true" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-slate-900">
                  {{ option.label }}
                </span>
                <span class="mt-0.5 block text-sm leading-5 text-slate-600">
                  {{ option.description }}
                </span>
              </span>

              <ChevronRightIcon class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { formatWhatsAppPhone } from '@/utils/formatters'

interface ContactOption {
  id: string
  label: string
  description: string
  message: string
  icon: Component
}

const props = withDefaults(defineProps<{
  isOpen: boolean
  phoneDigits: string
  contextLabel?: string
}>(), {
  contextLabel: '',
})

const emit = defineEmits<{
  close: []
}>()

const contactOptions: ContactOption[] = [
  {
    id: 'products',
    label: 'Produtos e disponibilidade',
    description: 'Tamanhos, estoque, sabores ou detalhes do item.',
    message: 'Ola! Vim pelo catalogo BipFlow e tenho uma duvida sobre produtos e disponibilidade.',
    icon: ShoppingBagIcon,
  },
  {
    id: 'delivery',
    label: 'Entrega e retirada',
    description: 'Prazos, bairros atendidos e valor de entrega.',
    message: 'Ola! Vim pelo catalogo BipFlow e quero saber mais sobre entrega ou retirada.',
    icon: TruckIcon,
  },
  {
    id: 'payment',
    label: 'Formas de pagamento',
    description: 'Pix, cartao, dinheiro ou combinacao de pagamento.',
    message: 'Ola! Vim pelo catalogo BipFlow e tenho uma duvida sobre formas de pagamento.',
    icon: CreditCardIcon,
  },
  {
    id: 'order',
    label: 'Pedido em andamento',
    description: 'Acompanhar, ajustar ou confirmar um pedido.',
    message: 'Ola! Vim pelo catalogo BipFlow e preciso de ajuda com um pedido em andamento.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    id: 'human',
    label: 'Falar com atendente',
    description: 'Abrir uma conversa direta com a equipe da loja.',
    message: 'Ola! Vim pelo catalogo BipFlow e gostaria de falar com um atendente.',
    icon: UserIcon,
  },
]

const normalizedDigits = computed(() => props.phoneDigits.replace(/\D/g, ''))
const isConfigured = computed(() => normalizedDigits.value.length > 0)
const formattedPhone = computed(() => formatWhatsAppPhone(normalizedDigits.value))
const normalizedContext = computed(() => props.contextLabel.trim())

function buildMessage(option: ContactOption): string {
  if (!normalizedContext.value) {
    return option.message
  }

  return `${option.message}\n\nProduto de interesse: ${normalizedContext.value}`
}

function openWhatsApp(option: ContactOption): void {
  const url = `https://api.whatsapp.com/send?phone=${normalizedDigits.value}&text=${encodeURIComponent(buildMessage(option))}`
  window.open(url, '_blank', 'noopener,noreferrer')
  emit('close')
}
</script>

<style scoped>
.contact-options-enter-active,
.contact-options-leave-active {
  transition: opacity 0.22s ease;
}

.contact-options-enter-active section,
.contact-options-leave-active section {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.contact-options-enter-from,
.contact-options-leave-to {
  opacity: 0;
}

.contact-options-enter-from section,
.contact-options-leave-to section {
  opacity: 0;
  transform: translateY(-18px) scale(0.98);
}
</style>
