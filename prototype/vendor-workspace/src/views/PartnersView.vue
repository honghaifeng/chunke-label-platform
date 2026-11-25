<script setup lang="ts">
import { toast } from '@/composables/toast'
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>服务商列表</h1>
      <span class="sub">管理当前活跃的合作服务商关系</span>
      <div class="spacer"></div>
      <button class="btn primary" @click="toast('邀请服务商（演示）', 'info')">邀请服务商</button>
    </div>

    <div class="panel">
      <div class="empty">
        <div class="empty-art">
          <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
            <circle cx="32" cy="32" r="24" fill="#f2f3f5" />
            <circle cx="26" cy="27" r="6" fill="#fff" stroke="#c9cdd4" stroke-width="2" />
            <path d="M16 44c0-6 4.5-9 10-9s10 3 10 9" fill="none" stroke="#c9cdd4" stroke-width="2" stroke-linecap="round" />
            <circle cx="42" cy="29" r="4.6" fill="#fff" stroke="#dcdfe6" stroke-width="2" />
            <path d="M36 44c0-4.6 3-7 6.6-7 3.4 0 6.4 2.4 6.4 7" fill="none" stroke="#dcdfe6" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <p class="empty-title">暂无合作服务商</p>
        <p class="empty-sub">邀请你的服务商加入后，可以在这里管理合作关系，并向其投递任务。</p>
        <button class="btn" @click="toast('邀请服务商（演示）', 'info')">邀请服务商</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty { padding: 64px 16px 72px; text-align: center; }
.empty-art { display: grid; place-items: center; margin-bottom: 10px; }
.empty-title { font-size: 13px; color: var(--ink-2); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--ink-3); margin: 0 0 14px; }
</style>
