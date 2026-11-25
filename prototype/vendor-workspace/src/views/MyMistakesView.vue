<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const role = ref<'annotator' | 'reviewer'>('annotator')
const start = ref('2026/10/26 00:00')
const end = ref('2026/11/25 23:59')

function query() {
  toast(`查询完成：显示 0-0 条，共 0 条`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>我的错题集</h1>
      <span class="sub">自动归集你在标注 / 质检环节与最终采纳版本不一致的样本，方便复盘提升</span>
    </div>

    <div class="mm-seg">
      <button :class="{ on: role === 'annotator' }" @click="role = 'annotator'">标注员视角</button>
      <button :class="{ on: role === 'reviewer' }" @click="role = 'reviewer'">质检员视角</button>
    </div>

    <div class="query-row">
      <div class="date-group">
        <span class="fl">日期</span>
        <div class="date-box">
          <input v-model="start" readonly />
          <Icon name="calendar" :size="14" color="#6b7280" />
        </div>
        <span class="dash">—</span>
        <div class="date-box">
          <input v-model="end" readonly />
          <Icon name="calendar" :size="14" color="#6b7280" />
        </div>
      </div>
      <button class="query-btn" @click="query"><Icon name="search" :size="14" color="#fff" />查询</button>
      <span class="count-text">显示 0-0 条，共 0 条</span>
    </div>

    <div class="empty-card">
      <div class="empty-icon"><Icon name="mailOpen" :size="24" color="#6b7280" /></div>
      <div class="empty-title">暂无错题</div>
      <div class="empty-desc">当任务被采纳的最终文本与你提交的版本不一致时，会在这里自动归集</div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 0 8px 24px; }
.page-head { margin: -24px -32px 0; padding: 16px 32px; background: transparent; border-bottom: none; position: static; }

.mm-seg {
  display: inline-flex; align-items: center; gap: 2px; margin: 32px 0 20px;
  padding: 4px; background: #f3f4f6; border-radius: 6px;
}
.mm-seg button {
  height: 32px; padding: 0 12px; border: none; border-radius: 4.8px; background: transparent;
  font-family: inherit; font-size: 14px; font-weight: 500; color: #6b7280; cursor: pointer;
}
.mm-seg button.on { background: #f9fafb; color: #111827; }

.query-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.date-group { display: flex; align-items: center; gap: 8px; }
.fl { font-size: 12px; color: #6b7280; }
.date-box {
  display: flex; align-items: center; gap: 6px; width: 200px; height: 36px; padding: 4px 10px;
  border: 1px solid #e5e7eb; border-radius: 6px; background: #fff;
}
.date-box input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: inherit; font-size: 14px; color: #111827;
}
.dash { font-size: 16px; color: #6b7280; }
.query-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px;
  border: none; border-radius: 6px; background: #3b82f6; color: #fff;
  font-family: inherit; font-size: 14px; font-weight: 500; cursor: pointer;
}
.count-text { margin-left: auto; font-size: 14px; color: #6b7280; }

.empty-card {
  height: 238px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 64px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8.4px;
}
.empty-icon { width: 48px; height: 48px; border-radius: 50%; background: #f3f4f6; display: grid; place-items: center; }
.empty-title { font-size: 14px; font-weight: 500; color: #111827; }
.empty-desc { font-size: 12px; color: #6b7280; }
</style>
