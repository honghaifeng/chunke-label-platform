<script setup lang="ts">
import { computed, ref } from 'vue'

type Serie = { name: string; color: string; values: number[] }

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: Serie[]
    height?: number
    ymode?: 'number' | 'duration'
    shade?: number[]
    tooltipNote?: string
    showLegend?: boolean
  }>(),
  { height: 240, ymode: 'number', shade: () => [], tooltipNote: '', showLegend: true }
)

const W = 760
const L = 40
const R = 10
const T = 14
const B = 26

const hover = ref(-1)

const maxVal = computed(() => {
  let m = 0
  for (const s of props.series) for (const v of s.values) m = Math.max(m, v)
  return m
})

function niceNum(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / p
  let n: number
  if (f <= 1) n = 1
  else if (f <= 2) n = 2
  else if (f <= 2.5) n = 2.5
  else if (f <= 5) n = 5
  else n = 10
  return n * p
}

const yStep = computed(() => {
  const m = maxVal.value
  if (m <= 0) return 1
  return niceNum(m / 4)
})

const yMax = computed(() => {
  const m = maxVal.value
  if (m <= 0) return props.ymode === 'duration' ? 240 : 8
  return yStep.value * 4
})

const ticks = computed(() => {
  const out: number[] = []
  for (let i = 0; i <= 4; i++) out.push(yStep.value * i)
  return out
})

function fmtY(v: number) {
  if (props.ymode === 'duration') {
    if (v === 0) return '0s'
    if (v >= 60) return `${Math.round(v / 60)}m`
    return `${Math.round(v)}s`
  }
  return String(Math.round(v * 10) / 10)
}

const plotW = W - L - R
const plotH = computed(() => props.height - T - B)

function x(i: number) {
  const n = props.labels.length
  if (n <= 1) return L
  return L + (plotW * i) / (n - 1)
}

function y(v: number) {
  return T + plotH.value - (v / yMax.value) * plotH.value
}

function pathOf(values: number[]) {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}

function areaOf(values: number[]) {
  const base = T + plotH.value
  return `${pathOf(values)} L${x(values.length - 1).toFixed(1)},${base} L${L},${base} Z`
}

const labelStep = computed(() => (props.labels.length <= 20 ? 1 : Math.ceil(props.labels.length / 16)))
function showLabel(i: number) {
  return i % labelStep.value === 0
}

function onMove(e: MouseEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  const n = props.labels.length
  if (n <= 1) return
  const idx = Math.round(((px - L) / plotW) * (n - 1))
  hover.value = Math.min(n - 1, Math.max(0, idx))
}

const tipLeft = computed(() => {
  if (hover.value < 0) return '0%'
  return `${(x(hover.value) / W) * 100}%`
})
const tipTop = computed(() => {
  let top = T + plotH.value
  for (const s of props.series) top = Math.min(top, y(s.values[hover.value] ?? 0))
  return `${(top / props.height) * 100}%`
})
</script>

<template>
  <div class="chart-wrap" :style="{ height: height + 'px' }">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" @mousemove="onMove" @mouseleave="hover = -1">
      <!-- 周末底纹 -->
      <rect
        v-for="i in shade"
        :key="'sh' + i"
        :x="x(i) - plotW / Math.max(1, labels.length - 1) / 2"
        :y="T"
        :width="plotW / Math.max(1, labels.length - 1)"
        :height="plotH"
        fill="#f7f8fa"
      />
      <!-- 横向网格 -->
      <g v-for="(t, i) in ticks" :key="'t' + i">
        <line :x1="L" :x2="W - R" :y1="y(t)" :y2="y(t)" stroke="#eef0f3" stroke-width="1" stroke-dasharray="3 4" />
        <text :x="L - 8" :y="y(t) + 4" text-anchor="end" font-size="10" fill="#9aa1ac">{{ fmtY(t) }}</text>
      </g>
      <!-- 面积 -->
      <path v-if="series.length" :d="areaOf(series[0].values)" fill="rgba(91,143,249,.14)" />
      <!-- 折线 -->
      <g v-for="(s, si) in series" :key="s.name">
        <path :d="pathOf(s.values)" fill="none" :stroke="s.color" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
        <circle
          v-for="(v, i) in s.values"
          :key="si + '-' + i"
          :cx="x(i)"
          :cy="y(v)"
          r="2.7"
          fill="#fff"
          :stroke="s.color"
          stroke-width="1.6"
        />
      </g>
      <!-- x 轴标签 -->
      <text
        v-for="(lb, i) in labels"
        v-show="showLabel(i)"
        :key="'x' + i"
        :x="x(i)"
        :y="height - 8"
        text-anchor="middle"
        font-size="10"
        fill="#9aa1ac"
      >{{ lb }}</text>
      <!-- hover 指示线 -->
      <line v-if="hover >= 0" :x1="x(hover)" :x2="x(hover)" :y1="T" :y2="T + plotH" stroke="#c9cdd4" stroke-width="1" />
    </svg>
    <div v-if="hover >= 0" class="tip" :style="{ left: tipLeft, top: tipTop }">
      <div class="tip-date">{{ labels[hover] }}</div>
      <div v-for="s in series" :key="s.name" class="tip-row">
        <i :style="{ background: s.color }"></i>
        <span class="n">{{ s.name }}</span>
        <b>{{ ymode === 'duration' ? fmtY(s.values[hover]) : s.values[hover] }}</b>
      </div>
      <div v-if="tooltipNote" class="tip-note">{{ tooltipNote }}</div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap { position: relative; width: 100%; }
svg { width: 100%; height: 100%; display: block; overflow: visible; }
.tip {
  position: absolute; transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none;
  background: #fff; border: 1px solid #e5e6eb; border-radius: 8px; box-shadow: 0 6px 20px rgba(31, 35, 41, .12);
  padding: 8px 10px; min-width: 130px; z-index: 2;
}
.tip-date { font-size: 11px; color: #8a919f; margin-bottom: 4px; }
.tip-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #1f2329; line-height: 1.8; }
.tip-row i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.tip-row .n { color: #4e5969; }
.tip-row b { margin-left: auto; font-family: var(--mono); font-size: 12px; }
.tip-note { font-size: 10px; color: #9aa1ac; margin-top: 4px; max-width: 190px; }
</style>
