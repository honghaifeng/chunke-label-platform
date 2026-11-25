<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const pid = computed(() => String(route.params.pid || ''))
const project = ref('')
const annotator = ref('')
const from = ref('')
const to = ref('')

function reset() {
  project.value = ''
  annotator.value = ''
  from.value = ''
  to.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="title-with-ico">
        <span class="pause-ico">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M9 6v12M15 6v12" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        </span>
        挂起任务管理
      </h1>
      <span class="sub">查看并管理所有挂起中的标注任务，支持再分配与无效化操作</span>
      <button class="refresh-btn" title="刷新" @click="toast('已刷新', 'success')">
        <Icon name="refresh" :size="17" color="#6b7280" />
      </button>
    </div>

    <div class="filter-bar">
      <div v-if="!pid" class="field">
        <label>项目</label>
        <input v-model="project" class="input" placeholder="搜索项目名称" />
      </div>
      <div class="field">
        <label>标注员</label>
        <input v-model="annotator" class="input" placeholder="搜索标注员" />
      </div>
      <div class="field">
        <label>挂起开始时间</label>
        <label class="date-box">
          <input v-model="from" type="date" />
          <span class="ph">年 / 月 / 日</span>
          <Icon name="calendar" :size="14" color="#9ca3af" />
        </label>
      </div>
      <div class="field">
        <label>挂起结束时间</label>
        <label class="date-box">
          <input v-model="to" type="date" />
          <span class="ph">年 / 月 / 日</span>
          <Icon name="calendar" :size="14" color="#9ca3af" />
        </label>
      </div>
      <button class="btn primary" @click="toast('已按条件查询（演示）', 'info')">
        <Icon name="search" :size="13" color="#fff" />搜索
      </button>
      <button class="btn reset-btn" @click="reset">重置</button>
    </div>

    <div class="empty">
      <span class="empty-ico">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M10 9v6M14 9v6" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </span>
      <p class="empty-title">暂无挂起任务</p>
    </div>
  </div>
</template>

<style scoped>
.title-with-ico { display: flex; align-items: center; gap: 8px; }
.pause-ico {
  width: 24px; height: 24px; border-radius: 50%; background: #fef3c7; display: inline-grid; place-items: center;
}
.refresh-btn {
  position: absolute; right: 24px; bottom: 14px; width: 30px; height: 30px; display: grid; place-items: center;
  border: none; background: transparent; border-radius: 6px; cursor: pointer;
}
.refresh-btn:hover { background: #f3f4f6; }
.page-head { margin-bottom: 8px; }
.filter-bar { display: flex; align-items: flex-end; gap: 12px; padding: 0 0 16px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; color: var(--ink-3); }
.field .input { width: 144px; }
.date-box {
  position: relative; display: inline-flex; align-items: center; height: 32px; width: 144px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff; padding: 0 8px;
}
.date-box input {
  position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;
  border: none; font-family: inherit;
}
.date-box .ph { font-size: 13px; color: var(--ink-3); flex: 1; }
.date-box > svg { pointer-events: none; }
.filter-bar .btn { height: 32px; padding: 0 10px; font-size: 12.8px; border-radius: 4.8px; }
.reset-btn { background: transparent; border-color: transparent; color: var(--ink-3); }
.empty {
  height: 312px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.empty-ico {
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line);
  display: grid; place-items: center; background: #fff;
}
.empty-title { font-size: 12px; color: var(--ink-3); margin: 0; }
</style>
