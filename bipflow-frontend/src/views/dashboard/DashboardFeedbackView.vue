<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChatBubbleBottomCenterTextIcon, EyeIcon } from '@heroicons/vue/24/outline'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect'
import { useToast } from '@/composables/useToast'
import {
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_OPTIONS,
  getFeedbackStatusBadgeClass,
  getFeedbackStatusLabel,
  getFeedbackTypeLabel,
} from '@/constants/feedback'
import { feedbackService } from '@/services/feedback.service'
import { formatDateTimeBR } from '@/utils/formatters'
import { Logger } from '@/services/logger'
import { buildErrorContext, type ApplicationError } from '@/types/errors'
import type {
  FeedbackReport,
  FeedbackStatus,
  FeedbackType,
  PaginatedFeedbackReportsResponse,
} from '@/types/feedback'
import FeedbackDetailModal from '@/components/dashboard/feedback/FeedbackDetailModal.vue'

/**
 * First version of the Feedbacks dashboard page (see feedback evolution
 * notes): a small, reliable listing + detail. No help-desk features
 * (assignment, SLAs, internal comments) -- those are explicitly deferred.
 * canManageCatalog gates status changes, same underlying permission the
 * backend's CustomerFeedbackViewSet.update_status checks
 * (has_dashboard_write_access) -- no dedicated "can_manage_feedback" role
 * exists yet, so this reuses the closest existing one rather than adding a
 * new backend field for a single button.
 */
const { canManageCatalog } = useCurrentUser()
const { error: toastError } = useToast()

const {
  data: reportsPage,
  isLoading,
  error: listError,
  run: runReports,
} = useAsyncResource<PaginatedFeedbackReportsResponse>()

const reports = computed(() => reportsPage.value?.results ?? [])
const totalPages = computed(() => reportsPage.value?.total_pages ?? 1)
const hasNextPage = computed(() => (
  reportsPage.value?.next !== null && reportsPage.value?.next !== undefined
))
const hasPreviousPage = computed(() => (
  reportsPage.value?.previous !== null && reportsPage.value?.previous !== undefined
))

const statusFilter = ref<'all' | FeedbackStatus>('all')
const typeFilter = ref<'all' | FeedbackType>('all')
const dateFromFilter = ref('')
const dateToFilter = ref('')
const page = ref(1)

const hasActiveFilters = computed(() => (
  statusFilter.value !== 'all'
  || typeFilter.value !== 'all'
  || dateFromFilter.value !== ''
  || dateToFilter.value !== ''
))

function buildFilters() {
  return {
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    type: typeFilter.value === 'all' ? undefined : typeFilter.value,
    dateFrom: dateFromFilter.value || undefined,
    dateTo: dateToFilter.value || undefined,
    page: page.value,
  }
}

function fetchReports(): Promise<void> {
  return runReports(
    () => feedbackService.getReports({ pageSize: 20, ...buildFilters() }),
    'Nao foi possivel carregar os relatos agora.'
  )
}

function applyFilters(): void {
  page.value = 1
  void fetchReports()
}

function goToPage(nextPage: number): void {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return
  }
  page.value = nextPage
  void fetchReports()
}

const selectedFeedback = ref<FeedbackReport | null>(null)
const isDetailOpen = computed(() => selectedFeedback.value !== null)
const isUpdatingStatus = ref(false)
const updateError = ref<string | null>(null)

function openDetail(report: FeedbackReport): void {
  selectedFeedback.value = report
  updateError.value = null
}

function closeDetail(): void {
  selectedFeedback.value = null
}

async function handleUpdateStatus(nextStatus: FeedbackStatus): Promise<void> {
  const report = selectedFeedback.value
  if (!report || report.status === nextStatus) {
    return
  }

  isUpdatingStatus.value = true
  updateError.value = null

  try {
    await feedbackService.updateStatus(report.id, nextStatus)
    const updated = { ...report, status: nextStatus }
    selectedFeedback.value = updated

    if (reportsPage.value) {
      reportsPage.value = {
        ...reportsPage.value,
        results: reportsPage.value.results.map((row) => (row.id === report.id ? updated : row)),
      }
    }
  } catch (error: unknown) {
    Logger.error('Feedback status update failed', buildErrorContext(error as ApplicationError, { feedbackId: report.id }))
    updateError.value = 'Nao foi possivel atualizar o status. Tente novamente.'
    toastError('Nao foi possivel atualizar o status do relato.')
  } finally {
    isUpdatingStatus.value = false
  }
}

useStoreSwitchEffect(() => {
  page.value = 1
  void fetchReports()
})

onMounted(() => {
  void fetchReports()
})
</script>

<template>
  <div>
    <div>
      <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Vitrine</p>
      <h1 class="mt-1 text-xl font-black italic tracking-tighter text-[#05050A]">Feedbacks</h1>
    </div>

    <div class="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-[160px_160px_150px_150px]">
      <label class="block">
        <span class="sr-only">Filtrar por status</span>
        <select
          v-model="statusFilter"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
          @change="applyFilters"
        >
          <option value="all">Todos status</option>
          <option v-for="option in FEEDBACK_STATUS_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="sr-only">Filtrar por tipo</span>
        <select
          v-model="typeFilter"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
          @change="applyFilters"
        >
          <option value="all">Todos tipos</option>
          <option v-for="option in FEEDBACK_TYPE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="sr-only">Data inicial</span>
        <input
          v-model="dateFromFilter"
          type="date"
          class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
          @change="applyFilters"
        />
      </label>

      <label class="block">
        <span class="sr-only">Data final</span>
        <input
          v-model="dateToFilter"
          type="date"
          class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
          @change="applyFilters"
        />
      </label>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-if="isLoading" class="rounded-lg border border-[#E5E7EB] bg-white p-4 sm:col-span-2 xl:col-span-3">
        <div class="h-4 w-32 animate-pulse rounded bg-zinc-100" />
        <div class="mt-3 h-3 w-48 animate-pulse rounded bg-zinc-100" />
      </div>

      <div
        v-else-if="listError"
        class="rounded-lg border border-[#111827]/20 bg-[#F3F4F6] p-4 text-sm text-[#374151] sm:col-span-2 xl:col-span-3"
      >
        {{ listError }}
      </div>

      <div
        v-else-if="reports.length === 0"
        class="rounded-lg border border-[#E5E7EB] bg-white p-4 sm:col-span-2 xl:col-span-3"
      >
        <p class="text-sm font-semibold text-[#05050A]">
          {{ hasActiveFilters ? 'Nenhum relato encontrado.' : 'Nenhum feedback recebido ainda.' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-bip-muted">
          {{
            hasActiveFilters
              ? 'Ajuste os filtros de status, tipo ou data.'
              : 'Relatos enviados pela vitrine publica aparecem aqui automaticamente.'
          }}
        </p>
      </div>

      <template v-else>
        <article
          v-for="report in reports"
          :key="report.id"
          class="rounded-lg border border-[#E5E7EB] bg-white p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">
                {{ getFeedbackTypeLabel(report.feedback_type) }}
              </p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-bip-muted">
                <ChatBubbleBottomCenterTextIcon class="h-3.5 w-3.5" />
                {{ formatDateTimeBR(report.created_at) }}
              </p>
            </div>
            <button
              type="button"
              class="flex shrink-0 items-center gap-1 rounded-full border border-[#E5E7EB] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:border-[#111827] hover:text-[#111827]"
              @click="openDetail(report)"
            >
              <EyeIcon class="h-3.5 w-3.5" />
              Detalhes
            </button>
          </div>

          <p class="mt-3 line-clamp-2 text-sm leading-6 text-[#05050A]">{{ report.message }}</p>

          <div class="mt-4 flex items-center justify-between gap-3">
            <p v-if="report.product_name || report.order_reference" class="truncate text-xs text-bip-muted">
              {{ report.product_name || report.order_reference }}
            </p>
            <span v-else />
            <span
              class="shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              :class="getFeedbackStatusBadgeClass(report.status)"
            >
              {{ getFeedbackStatusLabel(report.status) }}
            </span>
          </div>
        </article>
      </template>
    </div>

    <div
      v-if="!isLoading && !listError && reports.length > 0 && (hasNextPage || hasPreviousPage)"
      class="mt-6 flex items-center justify-between gap-3"
    >
      <button
        type="button"
        class="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-xs font-bold text-[#05050A] transition hover:border-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!hasPreviousPage"
        @click="goToPage(page - 1)"
      >
        Anterior
      </button>
      <p class="text-[11px] font-bold uppercase tracking-widest text-bip-muted">
        Pagina {{ page }} de {{ totalPages }}
      </p>
      <button
        type="button"
        class="rounded-lg border border-[#D1D5DB] bg-white px-4 py-2 text-xs font-bold text-[#05050A] transition hover:border-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!hasNextPage"
        @click="goToPage(page + 1)"
      >
        Proxima
      </button>
    </div>

    <FeedbackDetailModal
      :show="isDetailOpen"
      :feedback="selectedFeedback"
      :can-manage="canManageCatalog"
      :is-updating="isUpdatingStatus"
      :update-error="updateError"
      @close="closeDetail"
      @update-status="handleUpdateStatus"
    />
  </div>
</template>
