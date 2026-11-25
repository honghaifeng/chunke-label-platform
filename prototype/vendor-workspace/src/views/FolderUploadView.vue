<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const pid = Number(route.params.pid)
const files = ref<{ name: string; size: string; progress: number }[]>([])
const dragging = ref(false)

const demoFiles = [
  { name: 'kefu_batch_01.wav', size: '86.2 MB' },
  { name: 'kefu_batch_02.wav', size: '74.8 MB' },
  { name: 'kefu_batch_03.wav', size: '92.1 MB' },
  { name: 'kefu_batch_04.wav', size: '68.4 MB' }
]

function pick() {
  files.value = demoFiles.map((f) => ({ ...f, progress: 0 }))
  files.value.forEach((f, i) => {
    const t = setInterval(() => {
      f.progress = Math.min(100, f.progress + 9)
      if (f.progress >= 100) {
        clearInterval(t)
        if (i === files.value.length - 1) toast('文件夹上传完成（演示）', 'ok')
      }
    }, 120)
  })
}

function drop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  pick()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>上传整个文件夹</h1>
      <span class="sub">支持批量导入音频文件夹，自动识别时长与格式</span>
      <div class="spacer"></div>
      <button class="btn" @click="router.push(`/vendor/project/${pid}/recordings/record`)">页面录音</button>
      <button class="btn" @click="router.push(`/vendor/project/${pid}/recordings`)">返回数据管理</button>
    </div>

    <div
      class="drop"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop="drop"
      @click="pick"
    >
      <div class="drop-icon">⇧</div>
      <div style="font-size: 14px; margin-bottom: 6px">将文件夹拖拽到此处，或点击选择文件夹</div>
      <div class="muted" style="font-size: 12px">支持 wav / mp3 / m4a，单文件夹不超过 500 个文件</div>
      <button class="btn" style="margin-top: 14px">选择文件夹</button>
    </div>

    <div v-if="files.length" class="panel" style="margin-top: 14px">
      <div class="panel-head"><h2>上传队列</h2><div class="spacer"></div><span class="muted" style="font-size: 12px">{{ files.length }} 个文件</span></div>
      <table class="table">
        <thead><tr><th>文件名</th><th style="width: 110px">大小</th><th style="width: 200px">进度</th><th style="width: 100px">状态</th></tr></thead>
        <tbody>
          <tr v-for="f in files" :key="f.name">
            <td class="mono">{{ f.name }}</td>
            <td class="mono">{{ f.size }}</td>
            <td>
              <div class="bar"><span :style="{ width: f.progress + '%' }"></span></div>
            </td>
            <td>
              <span class="tag" :class="f.progress >= 100 ? 'green' : 'blue'">{{ f.progress >= 100 ? '已完成' : '上传中' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.drop {
  background: #fff; border: 1px dashed var(--line-strong); border-radius: var(--radius-lg);
  padding: 56px 16px; text-align: center; cursor: pointer; transition: all .16s;
}
.drop:hover, .drop.dragging { border-color: var(--primary); background: #f5f9ff; }
.drop-icon { font-size: 30px; color: var(--primary); margin-bottom: 10px; }
.bar { height: 6px; background: #f2f3f5; border-radius: 3px; overflow: hidden; width: 160px; }
.bar span { display: block; height: 100%; background: var(--primary); transition: width .12s linear; }
</style>
