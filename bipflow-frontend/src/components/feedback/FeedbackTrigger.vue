<script setup lang="ts">
/**
 * Discreet entry point for the customer feedback dialog. Deliberately a
 * plain text link, not a floating widget -- see docs/architecture/*
 * feedback evolution notes: a persistent floating icon reads as "this app
 * might be broken" and hurts conversion, so this only ever sits in the
 * page's own footer area, at the same visual weight as any other
 * secondary link.
 */
import { useRoute } from 'vue-router'
import { useCustomerFeedback } from '@/composables/useCustomerFeedback'
import type { FeedbackType } from '@/types/feedback'

const props = withDefaults(defineProps<{
  /** Pre-fills the report when this trigger sits on a page already about a
   * specific product -- the customer never has to say which one. */
  productId?: number | null
  type?: FeedbackType
}>(), {
  productId: null,
  type: 'other',
})

const route = useRoute()
const { open } = useCustomerFeedback()

function handleClick(): void {
  open({ pagePath: route.fullPath, productId: props.productId, type: props.type })
}
</script>

<template>
  <button
    type="button"
    data-cy="feedback-trigger"
    class="min-h-11 rounded-lg px-2 text-xs font-medium text-[#6B7280] underline-offset-4 transition hover:text-[var(--store-primary,#111827)] hover:underline focus:outline-none focus:ring-2 focus:ring-[#E5E7EB]"
    @click="handleClick"
  >
    Problemas ou sugestoes? Fale com a gente
  </button>
</template>
