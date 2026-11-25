<script setup lang="ts">
import Icon from '@/components/Icon.vue'

type Row = { label: string; count: string; dur: string; pct: string; tip?: boolean; na?: boolean }
defineProps<{
  base: Row
  groups: { title: string; rows: Row[] }[]
}>()

function width(row: Row) {
  const v = parseFloat(row.pct)
  return Number.isFinite(v) ? `${Math.min(100, v)}%` : '0%'
}
</script>

<template>
  <div>
    <div class="sp-funnel-row">
      <div class="f-label">
        {{ base.label }}
        <span v-if="base.tip !== false" class="sp-tip"><Icon name="help" :size="13" /></span>
      </div>
      <div class="f-track"><i :style="{ width: width(base) }"></i></div>
      <div class="f-count">{{ base.count }}</div>
      <div class="f-val">{{ base.dur }}</div>
      <div class="f-pct">{{ base.pct }}</div>
    </div>

    <template v-for="g in groups" :key="g.title">
      <div class="sp-funnel-group">
        <span class="bar"></span>
        <span class="t">{{ g.title }}</span>
        <span class="line"></span>
      </div>
      <div class="rows">
        <div v-for="r in g.rows" :key="r.label" class="sp-funnel-row sub">
          <div class="f-label">
            {{ r.label }}
            <span v-if="r.tip !== false" class="sp-tip"><Icon name="help" :size="13" /></span>
          </div>
          <div class="f-track"><i :style="{ width: width(r) }"></i></div>
          <div class="f-count">{{ r.na ? '不适用' : r.count }}</div>
          <div class="f-val">{{ r.dur }}</div>
          <div class="f-pct">{{ r.pct }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 8px; }
.f-label { white-space: nowrap; }
</style>
