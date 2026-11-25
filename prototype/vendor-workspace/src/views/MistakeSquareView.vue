<script setup lang="ts">
import { ref } from 'vue'
import Icon from '@/components/Icon.vue'

const tab = ref<'all' | 'annotator' | 'reviewer'>('all')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>错题广场</h1>
    </div>

    <div class="tabs">
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">全部</button>
      <button :class="{ on: tab === 'annotator' }" @click="tab = 'annotator'">标注员错题</button>
      <button :class="{ on: tab === 'reviewer' }" @click="tab = 'reviewer'">质检员错题</button>
    </div>

    <div class="empty-card">
      <span class="glyph"><Icon name="mailOpen" :size="20" color="#3b82f6" /></span>
      <p>暂无已发布的错题</p>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 8px; }
.page-head { margin: 0; padding: 16px 32px; background: transparent; border-bottom: none; position: static; }
.page-head h1 { margin: 0; }
.tabs {
  display: inline-flex; align-items: stretch; margin: 25px 0; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
}
.tabs button {
  height: 32px; padding: 0 16px; border: none; background: #fff; color: #374151;
  font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
}
.tabs button.on { background: #eff6ff; color: #3b82f6; }
.empty-card {
  height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  padding: 64px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8.4px;
}
.empty-card .glyph {
  width: 40px; height: 40px; border-radius: 50%; background: #eff6ff;
  display: grid; place-items: center;
}
.empty-card p { margin: 0; font-size: 14px; font-weight: 500; color: #374151; }
</style>
