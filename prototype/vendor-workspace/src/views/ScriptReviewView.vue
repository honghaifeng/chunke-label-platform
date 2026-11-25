<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '@/composables/toast'

const tab = ref<'work' | 'stats' | 'accept'>('work')
const previewFirst = ref(true)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>台本评审</h1>
      <span class="sub">系统会为你自动分配一篇台本，完成后自动继续下一篇</span>
    </div>

    <div class="panel">
      <div class="seg tabs-pad">
        <button :class="{ on: tab === 'work' }" @click="tab = 'work'">审核工作台</button>
        <button :class="{ on: tab === 'stats' }" @click="tab = 'stats'">审核统计</button>
        <button :class="{ on: tab === 'accept' }" @click="tab = 'accept'">台本验收</button>
      </div>

      <div class="body">
        <div class="notice">
          <span class="notice-ico">
            <svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M8 4.6v4.2M8 11.1v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
          </span>
          需在对应项目中具备标注员身份，并配置该项目的语种。
        </div>

        <div class="actions">
          <button class="btn" @click="tab = 'stats'">查看评审统计</button>
          <button class="btn primary" @click="toast('正在分配台本（演示）', 'info')">开始评审</button>
          <button class="btn" @click="toast('打开我的评审记录（演示）', 'info')">我的评审记录</button>
        </div>

        <label class="chk">
          <input v-model="previewFirst" type="checkbox" />
          <span>提交前预览确认</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs-pad { margin: 14px 16px 0; }
.body { padding: 20px; }
.notice {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 6px;
  background: #f7f8fa; color: var(--ink-2); font-size: 12px; margin-bottom: 18px;
}
.notice-ico { color: var(--ink-3); display: grid; place-items: center; }
.actions { display: flex; gap: 8px; margin-bottom: 14px; }
.chk { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); cursor: pointer; }
.chk input { accent-color: var(--primary); }
</style>
