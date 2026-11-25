<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Segment } from '@/mock/types'
import { mulberry32 } from '@/mock/data'
import { fmtTime } from '@/mock'

const props = withDefaults(
  defineProps<{
    duration: number
    segments: Segment[]
    speakers: string[]
    mode?: 'annotate' | 'qc'
    selectedId?: number | null
    zoom?: number
    playhead?: number
    editable?: boolean
  }>(),
  { mode: 'annotate', selectedId: null, zoom: 1, playhead: 0, editable: true }
)

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'seek', time: number): void
  (e: 'create', payload: { start: number; end: number; speaker: string }): void
}>()

const ROW_H = 58
const rulerH = 22
const wrap = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const wrapWidth = ref(1000)
const drag = ref<{ speaker: string; startTime: number; endTime: number } | null>(null)

const canvasWidth = computed(() => Math.max(700, Math.round(wrapWidth.value * props.zoom)))
const canvasHeight = computed(() => rulerH + props.speakers.length * ROW_H)
const secondsPerPx = computed(() => props.duration / canvasWidth.value)

let ro: ResizeObserver | null = null

function timeToX(t: number) {
  return (t / props.duration) * canvasWidth.value
}

function draw() {
  const el = canvas.value
  if (!el) return
  const dpr = window.devicePixelRatio || 1
  el.width = canvasWidth.value * dpr
  el.height = canvasHeight.value * dpr
  el.style.width = `${canvasWidth.value}px`
  el.style.height = `${canvasHeight.value}px`
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

  // 时间刻度
  ctx.fillStyle = '#fafbfc'
  ctx.fillRect(0, 0, canvasWidth.value, rulerH)
  ctx.strokeStyle = '#e5e6eb'
  ctx.beginPath()
  ctx.moveTo(0, rulerH + 0.5)
  ctx.lineTo(canvasWidth.value, rulerH + 0.5)
  ctx.stroke()

  const step = props.duration > 180 ? 30 : props.duration > 90 ? 15 : 10
  ctx.fillStyle = '#86909c'
  ctx.font = '10px -apple-system, sans-serif'
  ctx.textBaseline = 'middle'
  for (let t = 0; t <= props.duration; t += step) {
    const x = timeToX(t)
    ctx.strokeStyle = '#e5e6eb'
    ctx.beginPath()
    ctx.moveTo(x + 0.5, rulerH - 5)
    ctx.lineTo(x + 0.5, rulerH)
    ctx.stroke()
    ctx.fillText(fmtTime(t).slice(0, 5), x + 3, 10)
  }

  props.speakers.forEach((sp, row) => {
    const top = rulerH + row * ROW_H
    const mid = top + ROW_H / 2
    ctx.fillStyle = row % 2 === 0 ? '#ffffff' : '#fcfcfd'
    ctx.fillRect(0, top, canvasWidth.value, ROW_H)
    ctx.strokeStyle = '#f0f1f3'
    ctx.beginPath()
    ctx.moveTo(0, top + ROW_H - 0.5)
    ctx.lineTo(canvasWidth.value, top + ROW_H - 0.5)
    ctx.stroke()

    // 说话人标签
    ctx.fillStyle = '#4e5969'
    ctx.font = '600 11px -apple-system, sans-serif'
    ctx.fillText(sp, 8, top + 12)

    const rand = mulberry32(Number(sp.replace(/\D/g, '')) * 97 + 13)
    ctx.fillStyle = '#c9cdd4'
    const barW = 2
    for (let x = 0; x < canvasWidth.value; x += barW + 1) {
      const amp = Math.pow(rand(), 1.7) * (ROW_H / 2 - 8)
      if (amp < 0.6) continue
      ctx.fillRect(x, mid - amp, barW, amp * 2)
    }
  })

  // 拉框
  props.segments.forEach((seg) => {
    const row = props.speakers.indexOf(seg.speaker)
    if (row < 0) return
    const top = rulerH + row * ROW_H + 4
    const h = ROW_H - 8
    const x = timeToX(seg.start)
    const w = Math.max(2, timeToX(seg.end) - x)
    const selected = props.selectedId === seg.id

    let fill = 'rgba(59,110,245,.14)'
    let stroke = '#3b6ef5'
    if (props.mode === 'qc') {
      if (seg.status === 'passed') { fill = 'rgba(0,168,112,.16)'; stroke = '#00a870' }
      if (seg.status === 'rejected') { fill = 'rgba(225,37,27,.16)'; stroke = '#e1251b' }
      if (seg.status === 'pending') { fill = 'rgba(255,143,31,.14)'; stroke = '#ff8f1f' }
    } else {
      if (seg.status === 'draft') { fill = 'rgba(255,143,31,.16)'; stroke = '#ff8f1f' }
      if (seg.status === 'done') { fill = 'rgba(0,168,112,.14)'; stroke = '#00a870' }
    }
    ctx.fillStyle = fill
    ctx.fillRect(x, top, w, h)
    ctx.strokeStyle = selected ? '#e1251b' : stroke
    ctx.lineWidth = selected ? 2 : 1
    ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1)
    ctx.lineWidth = 1

    if (w > 26) {
      ctx.fillStyle = selected ? '#e1251b' : '#4e5969'
      ctx.font = '10px -apple-system, sans-serif'
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 2, top, w - 4, h)
      ctx.clip()
      ctx.fillText(`#${seg.idx}`, x + 5, top + 11)
      ctx.restore()
    }
  })

  // 拖拽中的新建框
  if (drag.value) {
    const row = props.speakers.indexOf(drag.value.speaker)
    const x = timeToX(Math.min(drag.value.startTime, drag.value.endTime))
    const w = Math.abs(timeToX(drag.value.endTime) - timeToX(drag.value.startTime))
    ctx.fillStyle = 'rgba(225,37,27,.12)'
    ctx.fillRect(x, rulerH + row * ROW_H + 4, w, ROW_H - 8)
    ctx.strokeStyle = '#e1251b'
    ctx.strokeRect(x + 0.5, rulerH + row * ROW_H + 4.5, w, ROW_H - 9)
  }

  // 播放头
  const px = timeToX(props.playhead)
  ctx.strokeStyle = '#e1251b'
  ctx.beginPath()
  ctx.moveTo(px + 0.5, 0)
  ctx.lineTo(px + 0.5, canvasHeight.value)
  ctx.stroke()
  ctx.fillStyle = '#e1251b'
  ctx.beginPath()
  ctx.arc(px + 0.5, 4, 3.5, 0, Math.PI * 2)
  ctx.fill()
}

function toTime(e: PointerEvent | MouseEvent) {
  const rect = wrap.value!.getBoundingClientRect()
  const x = e.clientX - rect.left + wrap.value!.scrollLeft
  return Math.max(0, Math.min(props.duration, x * secondsPerPx.value))
}

function rowOf(e: PointerEvent | MouseEvent) {
  const rect = wrap.value!.getBoundingClientRect()
  const y = e.clientY - rect.top + wrap.value!.scrollTop - rulerH
  const idx = Math.floor(y / ROW_H)
  return props.speakers[Math.max(0, Math.min(props.speakers.length - 1, idx))]
}

function hitSegment(e: PointerEvent | MouseEvent): Segment | null {
  const t = toTime(e)
  const row = rowOf(e)
  const candidates = props.segments
    .filter((s) => s.speaker === row && t >= s.start - 0.15 && t <= s.end + 0.15)
    .sort((a, b) => b.end - b.start - (a.end - a.start))
  return candidates[0] || null
}

function onDown(e: PointerEvent) {
  const rect = wrap.value!.getBoundingClientRect()
  if (e.clientY - rect.top + wrap.value!.scrollTop < rulerH) {
    emit('seek', toTime(e))
    return
  }
  const hit = hitSegment(e)
  if (hit) {
    emit('select', hit.id)
    emit('seek', hit.start)
    return
  }
  if (!props.editable) {
    emit('seek', toTime(e))
    return
  }
  drag.value = { speaker: rowOf(e), startTime: toTime(e), endTime: toTime(e) }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onMove(e: PointerEvent) {
  if (!drag.value) return
  drag.value.endTime = toTime(e)
  draw()
}

function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (!drag.value) return
  const d = drag.value
  drag.value = null
  const start = Math.min(d.startTime, d.endTime)
  const end = Math.max(d.startTime, d.endTime)
  if (end - start >= 0.35) {
    emit('create', { start: Number(start.toFixed(2)), end: Number(end.toFixed(2)), speaker: d.speaker })
  }
  draw()
}

watch(
  () => [props.segments, props.selectedId, props.zoom, props.playhead, props.duration, props.speakers.length],
  () => draw(),
  { deep: true }
)

onMounted(() => {
  if (wrap.value) {
    wrapWidth.value = wrap.value.clientWidth
    ro = new ResizeObserver(() => {
      if (wrap.value) wrapWidth.value = wrap.value.clientWidth
      draw()
    })
    ro.observe(wrap.value)
  }
  draw()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
})

defineExpose({ draw })
</script>

<template>
  <div ref="wrap" class="wave-wrap" @pointerdown="onDown">
    <canvas ref="canvas" style="display: block"></canvas>
  </div>
</template>

<style scoped>
.wave-wrap {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  background: #fff;
  cursor: crosshair;
  border-bottom: 1px solid var(--line);
  user-select: none;
}
</style>
