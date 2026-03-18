<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: any;
  type?: string;
  placeholder?: string;
  error?: string;
}>();
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="space-y-2">
    <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{{ label }}</label>
    <input
      :type="type || 'text'"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :placeholder="placeholder"
      class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-700"
      :class="{ 'border-red-500/50': error }"
    />
    <p v-if="error" class="text-[10px] text-red-500 font-bold uppercase tracking-wider">{{ error }}</p>
  </div>
</template>