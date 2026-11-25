<script setup lang="ts">
withDefaults(defineProps<{ title: string; wide?: boolean }>(), { wide: false })
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal" :class="{ wide }">
      <div class="modal-head">{{ title }}</div>
      <div class="modal-body"><slot /></div>
      <div class="modal-foot"><slot name="foot" /></div>
    </div>
  </div>
</template>
