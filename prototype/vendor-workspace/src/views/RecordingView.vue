<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fmtTime } from '@/mock'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const pid = Number(route.params.pid)
const recording = ref(false)
const seconds = ref(0)
const records = ref([
  { name: '录音_20261125_0912.wav', duration: 46, at: '2026-11-25 09:12' },
  { name: '录音_20261125_0918.wav', duration: 63, at: '2026-11-25 09:18' }
])
let timer: number | null = null

function toggle() {
  if (recording.value) {
    recording.value = false
    if (timer) clearInterval(timer)
    timer = null
    if (seconds.value > 0) {
      records.value.unshift({
        name: `录音_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${String(9 + records.value.length).padStart(2, '0')}${records.value.length % 10}0.wav`,
        duration: seconds.value,
        at: new Date().toLocaleString('zh-CN', { hour12: false })
      })
    }
    seconds.value = 0
    toast('录音已保存到标注数据管理', 'ok')
    return
  }
  recording.value = true
  seconds.value = 0
  timer = window.setInterval(() => (seconds.value += 0.1), 100)
}

const wave = computed(() => Array.from({ length: 64 }).map((_, i) => 8 + Math.abs(Math.sin(i * 1.7 + seconds.value)) * 26))

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>页面录音</h1>
      <span class="sub">在浏览器内直接录制音频并上传到标注数据</span>
      <div class="spacer"></div>
      <button class="btn" @click="router.push(`/vendor/project/${pid}/recordings/folder-upload`)">上传整个文件夹</button>
      <button class="btn" @click="router.push(`/vendor/project/${pid}/recordings`)">返回数据管理</button>
    </div>

    <div class="panel">
      <div class="panel-body rec-box">
        <div class="mic" :class="{ on: recording }">●</div>
        <div class="rec-time mono">{{ fmtTime(seconds) }}</div>
        <div class="rec-wave">
          <span v-for="(h, i) in wave" :key="i" :style="{ height: h + 'px' }"></span>
        </div>
        <div class="flex gap8">
          <button class="btn primary" style="height: 34px; width: 120px" @click="toggle">
            {{ recording ? '停止并保存' : '开始录音' }}
          </button>
          <button class="btn" style="height: 34px" :disabled="recording" @click="toast('已切换麦克风设备（演示）', 'info')">切换设备</button>
        </div>
        <div class="muted" style="font-size: 12px; margin-top: 10px">
          录音格式 WAV · 采样率 16kHz · 单声道；单段最长 30 分钟，超过自动切分。
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 14px">
      <div class="panel-head"><h2>本次录音记录</h2><div class="spacer"></div><span class="muted" style="font-size: 12px">{{ records.length }} 条</span></div>
      <table class="table">
        <thead><tr><th>文件名</th><th style="width: 120px">时长</th><th style="width: 180px">录制时间</th><th style="width: 120px">操作</th></tr></thead>
        <tbody>
          <tr v-for="r in records" :key="r.name">
            <td class="mono">{{ r.name }}</td>
            <td class="mono">{{ fmtTime(r.duration) }}</td>
            <td class="muted">{{ r.at }}</td>
            <td><button class="btn sm ghost" @click="toast('试听（演示）', 'info')">试听</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.rec-box { display: flex; flex-direction: column; align-items: center; padding: 36px 16px; }
.mic { width: 56px; height: 56px; border-radius: 50%; background: #f2f3f5; color: var(--ink-4); display: grid; place-items: center; font-size: 18px; }
.mic.on { background: var(--brand-weak); color: var(--brand); animation: pulse 1.1s infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(225,37,27,.25); } 50% { box-shadow: 0 0 0 10px rgba(225,37,27,0); } }
.rec-time { font-size: 28px; margin: 14px 0; }
.rec-wave { display: flex; align-items: center; gap: 3px; height: 44px; margin-bottom: 18px; }
.rec-wave span { width: 3px; background: #f2c3bf; border-radius: 2px; }
</style>
