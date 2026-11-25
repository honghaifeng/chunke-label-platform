<script setup lang="ts">
import { toasts } from '@/composables/toast'
</script>

<template>
  <div class="toast-wrap">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.text }}</div>
  </div>
</template>
