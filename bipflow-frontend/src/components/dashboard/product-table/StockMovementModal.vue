<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowDownIcon, ArrowUpIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import { STOCK_MOVEMENT_REASONS, type StockMovementInput, type StockMovementType } from '@/types/stockMovement';

const props = defineProps<{
  show: boolean;
  product: Product | null;
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', payload: StockMovementInput): void;
}>();

const movementType = ref<StockMovementType>('entrada');
const quantity = ref<number>(1);
const reason = ref<string>('');
const notes = ref<string>('');
const errors = ref<Record<string, string>>({});

const reasonOptions = computed(() => STOCK_MOVEMENT_REASONS[movementType.value]);

const currentStock = computed(() => Number(props.product?.stock_quantity ?? 0));
const projectedStock = computed(() =>
  movementType.value === 'entrada' ? currentStock.value + quantity.value : currentStock.value - quantity.value
);

const resetForm = (): void => {
  movementType.value = 'entrada';
  quantity.value = 1;
  reason.value = '';
  notes.value = '';
  errors.value = {};
};

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      resetForm();
    }
  }
);

watch(movementType, () => {
  reason.value = '';
});

const selectType = (type: StockMovementType): void => {
  movementType.value = type;
};

const handleSubmit = (): void => {
  errors.value = {};

  if (!quantity.value || quantity.value <= 0) {
    errors.value.quantity = 'Informe uma quantidade maior que zero.';
  }

  if (!reason.value) {
    errors.value.reason = 'Selecione um motivo.';
  }

  if (movementType.value === 'saida' && projectedStock.value < 0) {
    errors.value.quantity = 'Quantidade maior que o estoque disponível.';
  }

  if (Object.keys(errors.value).length > 0) {
    return;
  }

  emit('submit', {
    movement_type: movementType.value,
    quantity: quantity.value,
    reason: reason.value,
    notes: notes.value.trim() || undefined,
  });
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay">
        <div class="modal-container">
          <div class="alert-line"></div>

          <button
            type="button"
            aria-label="Fechar"
            class="close-button"
            @click="emit('close')"
          >
            <XMarkIcon class="h-4 w-4" />
          </button>

          <h3 class="text-xl font-black text-[#05050A] italic uppercase tracking-tighter mb-1">
            Movimentar estoque
          </h3>
          <p class="text-[10px] text-bip-muted font-bold uppercase tracking-[0.2em] mb-6">
            {{ product?.name }}
          </p>

          <div class="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              data-cy="btn-movement-type-entrada"
              class="type-toggle"
              :class="movementType === 'entrada' ? 'type-toggle-active' : ''"
              @click="selectType('entrada')"
            >
              <ArrowDownIcon class="h-4 w-4" />
              Entrada
            </button>
            <button
              type="button"
              data-cy="btn-movement-type-saida"
              class="type-toggle"
              :class="movementType === 'saida' ? 'type-toggle-active' : ''"
              @click="selectType('saida')"
            >
              <ArrowUpIcon class="h-4 w-4" />
              Saída
            </button>
          </div>

          <div class="space-y-4">
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Quantidade</label>
              <input
                v-model.number="quantity"
                type="number"
                min="1"
                data-cy="input-movement-quantity"
                class="field-input"
              />
              <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="field-label">Motivo</label>
              <select v-model="reason" data-cy="select-movement-reason" class="field-input">
                <option value="" disabled>Selecione um motivo</option>
                <option v-for="option in reasonOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <p v-if="errors.reason" class="field-error">{{ errors.reason }}</p>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="field-label">Observação (opcional)</label>
              <textarea
                v-model="notes"
                data-cy="input-movement-notes"
                rows="2"
                class="field-input resize-none"
              />
            </div>

            <div class="preview-box">
              <span>Estoque atual: {{ currentStock }}</span>
              <span class="preview-arrow">→</span>
              <span :class="projectedStock < 0 ? 'text-[#D81B60]' : 'text-emerald-700'">
                Novo estoque: {{ projectedStock }}
              </span>
            </div>
          </div>

          <div class="flex w-full gap-4 mt-7">
            <button
              type="button"
              class="cancel-button"
              @click="emit('close')"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-cy="btn-confirm-movement"
              :disabled="isSubmitting"
              class="confirm-button"
              @click="handleSubmit"
            >
              {{ isSubmitting ? 'Salvando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
}

.modal-container {
  width: 100%;
  max-width: 28rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 2rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
}

.alert-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, #d81b60, transparent);
  opacity: 0.5;
}

.close-button {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  display: flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: #fafafa;
  color: #05050a;
}

.type-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  transition: all 0.2s ease;
}

.type-toggle-active {
  background-color: #fce7f3;
  border-color: #d81b60;
  color: #d81b60;
}

.field-label {
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #6b7280;
}

.field-input {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #d1d5db;
  background-color: #ffffff;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  color: #05050a;
  outline: none;
  transition: all 0.2s ease;
}

.field-input:focus {
  border-color: #d81b60;
  box-shadow: 0 0 0 2px #fce7f3;
}

.field-error {
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #d81b60;
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  background-color: #fafafa;
  border: 1px solid #e5e7eb;
  padding: 0.75rem;
  font-size: 11px;
  font-weight: 700;
  color: #05050a;
}

.preview-arrow {
  color: #9ca3af;
}

.cancel-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  background-color: #fafafa;
}

.confirm-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  background-color: #d81b60;
  color: white;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.3s ease;
}

.confirm-button:hover:not(:disabled) {
  background-color: #ad1457;
  box-shadow: 0 0 20px rgba(216, 27, 96, 0.25);
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
