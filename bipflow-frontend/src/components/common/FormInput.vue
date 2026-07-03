<script setup lang="ts">
/**
 * 🛰️ BIPFLOW ATOMIC INPUT
 * Padrão: Manual Attribute Inheritance (NYC Standard)
 * Resolve: Erros de seletor no Cypress e consistência de Tipagem.
 */

// 1. Desabilitamos a herança automática para que o 'name' e 'data-cy'
// não fiquem presos na DIV externa, mas sim no INPUT real.
defineOptions({
  inheritAttrs: false
});

interface Props {
  label: string;
  modelValue: string | number | null;
  type?: string;
  placeholder?: string;
  error?: string;
}

defineProps<Props>();
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="space-y-2 group">
    <label class="block text-[10px] font-black text-bip-muted uppercase tracking-[0.2em] group-focus-within:text-[#D81B60] transition-colors">
      {{ label }}
    </label>

    <div class="relative">
      <input
        v-bind="$attrs"
        :type="type || 'text'"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :placeholder="placeholder"
        class="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-[16px] leading-6 text-[#05050A] outline-none transition-all placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3] active:translate-y-0"
        style="font-size: 16px;"
        :class="{ 'border-[#D81B60]/50 bg-[#FCE7F3]': error }"
      />
    </div>

    <Transition name="error-slide">
      <p v-if="error" class="text-[9px] text-[#D81B60] font-black uppercase tracking-widest animate-pulse">
        {{ error }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.error-slide-enter-active {
  transition: all 0.2s ease-out;
}
.error-slide-enter-from {
  transform: translateY(-5px);
  opacity: 0;
}

/* Remove estilos padrão de preenchimento automático do Chrome */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: #05050A;
  -webkit-box-shadow: 0 0 0px 1000px #FFFFFF inset;
  transition: background-color 5000s ease-in-out 0s;
}
</style>
