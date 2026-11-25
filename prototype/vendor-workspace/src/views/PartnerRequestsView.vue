<script setup lang="ts">
import { ref } from 'vue'

const tab = ref<'inbox' | 'mine'>('inbox')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>合作申请</h1>
      <span class="sub">管理收到和发出的合作申请</span>
    </div>

    <div class="panel">
      <div class="seg tabs-pad">
        <button :class="{ on: tab === 'inbox' }" @click="tab = 'inbox'">待我处理</button>
        <button :class="{ on: tab === 'mine' }" @click="tab = 'mine'">我的申请</button>
      </div>
      <div class="empty">
        <p class="empty-title">{{ tab === 'inbox' ? '暂无待处理申请' : '暂无我的申请' }}</p>
        <p class="empty-sub">
          {{ tab === 'inbox' ? '其它组织发起的合作申请会出现在这里。' : '你发起或受邀的合作申请会出现在这里。' }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs-pad { margin: 14px 16px 0; }
.empty { padding: 56px 16px 64px; text-align: center; }
.empty-title { font-size: 13px; color: var(--ink-2); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--ink-3); margin: 0; }
</style>
