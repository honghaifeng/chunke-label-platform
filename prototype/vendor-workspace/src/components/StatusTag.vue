<script setup lang="ts">
import { taskStatusTag } from '@/mock'

defineProps<{ text: string; color?: string }>()
</script>

<template>
  <span class="tag" :class="color || taskStatusTag(text)">{{ text }}</span>
</template>
