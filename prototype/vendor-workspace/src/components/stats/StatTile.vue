<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon?: string
    variant?: 'featured' | 'compact' | 'tile'
    tone?: 'blue' | 'green' | 'orange' | 'gray' | 'purple' | 'cyan'
    sub?: string
    subTone?: 'muted' | 'green' | 'amber'
    subPill?: boolean
    progress?: number
    tip?: boolean
    spark?: number[]
  }>(),
  { icon: 'clock', variant: 'featured', tone: 'blue', sub: '', subTone: 'muted', subPill: false, tip: false }
)

const toneStyle = computed(() => {
  const map = {
    blue: { bg: '#eff6ff', fg: '#3b82f6' },
    green: { bg: '#ecfdf5', fg: '#10b981' },
    orange: { bg: '#fffbeb', fg: '#f59e0b' },
    gray: { bg: '#f3f4f6', fg: '#64748b' },
    purple: { bg: '#f5f3ff', fg: '#8b5cf6' },
    cyan: { bg: '#ecfeff', fg: '#06b6d4' }
  }
  const t = map[props.tone]
  return { background: t.bg, color: t.fg }
})

// 将 1h 3m 28s 拆成数字 + 单位，单位用小号灰字（与线上一致）
const parts = computed(() => {
  const v = props.value
  if (!/^[\d.]+[hms](\s*[\d.]+[hms])*$/.test(v)) return null
  const out: { n: string; u: string }[] = []
  const re = /([\d.]+)([hms])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(v))) out.push({ n: m[1], u: m[2] })
  return out
})

const sparkPath = computed(() => {
  const vals = props.spark
  if (!vals || vals.length < 2) return ''
  const w = 96
  const h = 26
  const max = Math.max(...vals, 1)
  const step = w / (vals.length - 1)
  return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(' ')
})
</script>

<template>
  <div class="st" :class="variant">
    <template v-if="variant === 'compact'">
      <div class="ico" :style="toneStyle"><Icon :name="icon" :size="16" /></div>
      <div class="body">
        <p class="lbl">{{ label }}</p>
        <div class="val">
          <template v-if="parts">
            <template v-for="(p, i) in parts" :key="i"><b>{{ p.n }}</b><small>{{ p.u }}</small></template>
          </template>
          <template v-else>{{ value }}</template>
        </div>
        <p v-if="sub" class="sub" :class="subTone">{{ sub }}</p>
      </div>
    </template>

    <template v-else-if="variant === 'tile'">
      <div class="lbl">
        {{ label }}
        <span v-if="tip" class="sp-tip"><Icon name="help" :size="13" /></span>
      </div>
      <div class="val">
        <template v-if="parts">
          <template v-for="(p, i) in parts" :key="i"><b>{{ p.n }}</b><small>{{ p.u }}</small></template>
        </template>
        <template v-else>{{ value }}</template>
      </div>
      <p v-if="sub" class="sub">{{ sub }}</p>
    </template>

    <template v-else>
      <div class="ico" :style="toneStyle"><Icon :name="icon" :size="18" /></div>
      <p class="lbl">{{ label }}</p>
      <div class="val">
        <template v-if="parts">
          <template v-for="(p, i) in parts" :key="i"><b>{{ p.n }}</b><small>{{ p.u }}</small></template>
        </template>
        <template v-else>{{ value }}</template>
      </div>
      <p v-if="sub" class="sub" :class="[subTone, { pill: subPill }]">{{ sub }}</p>
      <div v-if="progress !== undefined" class="prog"><i :style="{ width: progress + '%' }"></i></div>
      <svg v-if="sparkPath" class="spark" viewBox="0 0 96 26" preserveAspectRatio="none">
        <path :d="sparkPath" fill="none" stroke="#5b8ff9" stroke-width="1.6" stroke-linecap="round" />
        <path :d="`${sparkPath} L96,26 L0,26 Z`" fill="rgba(91,143,249,.12)" stroke="none" />
      </svg>
    </template>
  </div>
</template>

<style scoped>
.st { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; position: relative; }
.st.featured { padding: 20px; display: flex; flex-direction: column; min-height: 183.2px; }
.st.featured .ico { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; }
.st.featured .lbl { font-size: 12px; font-weight: 400; color: #6b7280; margin: 12px 0 0; }
.st.featured .val { font-size: 26px; font-weight: 600; font-family: var(--mono); line-height: 42px; margin-top: 4px; color: #111827; }
.st.featured .val b { font-weight: 600; }
.st.featured .val small { font-size: 14px; font-weight: 400; color: #6b7280; margin: 0 3px 0 1px; font-family: var(--font); }
.st.featured .sub { font-size: 11px; color: #6b7280; margin: 8px 0 0; }
.st.featured .sub.green { color: #059669; }
.st.featured .sub.amber { color: #d97706; }
.st.featured .sub.pill {
  display: inline-flex; align-self: flex-start; align-items: center; padding: 2px 8px;
  border-radius: 999px; background: #ecfdf5; font-size: 12px;
}
.st.featured .prog { margin-top: 10px; height: 6px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
.st.featured .prog > i { display: block; height: 100%; border-radius: 999px; background: #3b82f6; }
.st.featured .spark { position: absolute; right: 16px; bottom: 24px; width: 96px; height: 26px; }

.st.compact { display: flex; align-items: center; gap: 12px; padding: 14px 16px; height: 70.4px; }
.st.compact .ico { width: 36px; height: 36px; border-radius: 6px; display: grid; place-items: center; flex: 0 0 36px; }
.st.compact .body { min-width: 0; }
.st.compact .lbl { font-size: 11.5px; color: #6b7280; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st.compact .val { font-size: 18px; font-weight: 600; font-family: var(--mono); line-height: 24px; color: #111827; margin-top: 2px; }
.st.compact .val b { font-weight: 600; }
.st.compact .val small { font-size: 12px; font-weight: 400; color: #6b7280; margin-left: 1px; font-family: var(--font); }
.st.compact .sub { font-size: 11px; color: #6b7280; margin: 2px 0 0; }
.st.compact .sub.green { color: #059669; }
.st.compact .sub.amber { color: #d97706; }

.st.tile { background: #f8fafc; border-color: #e5e7eb; border-radius: 8px; padding: 12px 14px; }
.st.tile .lbl { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; }
.st.tile .val { font-size: 20px; font-weight: 600; font-family: var(--font); margin-top: 5px; color: #111827; }
.st.tile .val b { font-weight: 600; }
.st.tile .val small { font-size: 12px; font-weight: 400; color: #6b7280; margin-left: 1px; font-family: var(--font); }
.st.tile .sub { font-size: 12px; color: #6b7280; margin: 4px 0 0; }
</style>
