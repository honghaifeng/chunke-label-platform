<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    hint?: string
    accent?: boolean
  }>(),
  { unit: '', hint: '', accent: false }
)
</script>

<template>
  <div class="stat-card">
    <div class="label">{{ label }}</div>
    <div class="value" :style="accent ? 'color:var(--primary)' : ''">
      {{ value }}<small v-if="unit">{{ unit }}</small>
    </div>
    <div v-if="hint" class="muted" style="font-size: 11px; margin-top: 4px">{{ hint }}</div>
  </div>
</template>
