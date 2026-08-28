import type { FeedbackStatus, FeedbackType } from '@/types/feedback'

// Friendly labels shown to the customer when picking a report type --
// mirrors the backend's CustomerFeedback.TYPE_CHOICES 1:1 (see
// bipdelivery/api/models.py) so a new type added there doesn't silently
// fall back to an unlabeled option here.
export const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'problem', label: 'Problema na compra' },
  { value: 'product', label: 'Produto' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'shipping', label: 'Entrega/Frete' },
  { value: 'purchase_difficulty', label: 'Dificuldade na compra' },
  { value: 'suggestion', label: 'Sugestao' },
  { value: 'other', label: 'Outro' },
]

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  problem: 'Problema na compra',
  purchase_difficulty: 'Dificuldade na compra',
  shipping: 'Entrega/Frete',
  checkout: 'Checkout',
  product: 'Produto',
  suggestion: 'Sugestao',
  other: 'Outro',
}

export function getFeedbackTypeLabel(type: FeedbackType): string {
  return FEEDBACK_TYPE_LABELS[type] ?? type
}

export const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'Novo' },
  { value: 'reviewing', label: 'Em analise' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'ignored', label: 'Ignorado' },
]

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Novo',
  reviewing: 'Em analise',
  resolved: 'Resolvido',
  ignored: 'Ignorado',
}

export function getFeedbackStatusLabel(status: FeedbackStatus): string {
  return FEEDBACK_STATUS_LABELS[status] ?? status
}

const FEEDBACK_STATUS_BADGE_CLASS: Record<FeedbackStatus, string> = {
  new: 'border-amber-200 bg-amber-50 text-amber-800',
  reviewing: 'border-sky-200 bg-sky-50 text-sky-800',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ignored: 'border-[#111827]/20 bg-[#F3F4F6] text-[#374151]',
}

export function getFeedbackStatusBadgeClass(status: FeedbackStatus): string {
  return FEEDBACK_STATUS_BADGE_CLASS[status] ?? FEEDBACK_STATUS_BADGE_CLASS.new
}
