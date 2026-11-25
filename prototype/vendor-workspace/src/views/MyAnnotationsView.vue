<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '@/composables/toast'

const status = ref('全部状态')
const node = ref('全部节点')
const qcStatus = ref('全部状态')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>我的标注</h1>
      <span class="sub">当前账号在本项目下的标注历史记录</span>
    </div>

    <div class="panel">
      <div class="filter-bar">
        <select v-model="status" class="select" style="width: 130px">
          <option>全部状态</option><option>标注中</option><option>待质检</option><option>已通过</option>
        </select>
        <select v-model="node" class="select" style="width: 130px">
          <option>全部节点</option><option>质检节点 A</option><option>质检节点 B</option>
        </select>
        <select v-model="qcStatus" class="select" style="width: 130px">
          <option>全部状态</option><option>未质检</option><option>通过</option><option>拒绝</option>
        </select>
        <button class="btn" @click="toast('已刷新质检状态（演示）', 'info')">刷新质检状态</button>
        <div class="spacer"></div>
        <span class="muted small">共 0 条</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>任务</th><th>音频</th><th>标注文本</th><th>有效性</th><th>版本</th><th>耗时</th>
              <th>质检状态</th><th>锁定状态</th><th>锁定时间</th><th>验收节点</th><th>申诉状态</th>
              <th>提交时间</th><th>操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="empty">
        <p class="empty-title">暂无标注记录</p>
        <p class="empty-sub">提交标注后会在这里显示</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.spacer { flex: 1; }
.small { font-size: 12px; }
.table-wrap { overflow-x: auto; }
.table-wrap .table { min-width: 1180px; }
.empty { padding: 40px 16px 48px; text-align: center; }
.empty-title { font-size: 13px; color: var(--ink-2); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--ink-3); margin: 0; }
</style>
