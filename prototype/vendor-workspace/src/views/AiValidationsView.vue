<script setup lang="ts">
import { ref } from 'vue'

const status = ref('全部')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>AI 质检结果</h1>
      <span class="sub">由系统自动执行的标注结果质检，仅展示你作为标注员的任务记录</span>
    </div>

    <div class="panel">
      <div class="filter-bar">
        <span class="fl">综合状态</span>
        <select v-model="status" class="select" style="width: 130px">
          <option>全部</option><option>通过</option><option>不通过</option>
        </select>
        <div class="spacer"></div>
        <span class="muted small">共 0 条</span>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>任务</th><th>语种</th><th>综合状态</th><th>问题数</th><th>AI 判定</th>
            <th>标注文本</th><th>质检时间</th><th>操作</th>
          </tr>
        </thead>
      </table>

      <div class="empty">
        <p class="empty-title">暂无符合条件的质检记录</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.spacer { flex: 1; }
.small { font-size: 12px; }
.fl { font-size: 12px; color: var(--ink-2); }
.empty { padding: 36px 16px 44px; text-align: center; }
.empty-title { font-size: 13px; color: var(--ink-3); margin: 0; }
</style>
