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
    <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
      {{ label }}
    </label>

    <div class="relative">
      <input
        v-bind="$attrs"
        :type="type || 'text'"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :placeholder="placeholder"
        class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-700 shadow-inner"
        :class="{ 'border-red-500/50 bg-red-500/5': error }"
      />
    </div>

    <Transition name="error-slide">
      <p v-if="error" class="text-[9px] text-red-500 font-black uppercase tracking-widest animate-pulse">
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

/* Remove estilos padrão de preenchimento automático do Chrome em modo dark */
input:-webkit-autofill,
input:-webkit-autofill:hover, 
input:-webkit-autofill:focus {
  -webkit-text-fill-color: white;
  -webkit-box-shadow: 0 0 0px 1000px #09090b inset;
  transition: background-color 5000s ease-in-out 0s;
}
</style>