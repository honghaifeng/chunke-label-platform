<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from '@/composables/toast'

const activeTab = ref('全部')
const annotator = ref('全部标注员')
const selected = ref<number[]>([])

const tabs = [
  { label: '全部', count: 5 }, { label: '待提交', count: 0 }, { label: '验收中', count: 0 },
  { label: '平台验收通过', count: 1 }, { label: '平台验收不通过', count: 0 },
  { label: '模型验收通过', count: 0 }, { label: '模型验收不通过', count: 0 }, { label: '已废弃', count: 2 }
]
const cards = [
  { label: '批次总数', value: '3' }, { label: '验收中', value: '0' }, { label: '验收通过', value: '1' },
  { label: '平台验收不通过', value: '0' }, { label: '待提交节点', value: '0' }
]

interface Row { kind: 'group' | 'node'; name: string; status: string; tasks: string; rate: string; rateSub?: string; createdAt?: string }

const rows: Row[] = [
  { kind: 'group', name: '未提交（尚无批次号）', status: '', tasks: '', rate: '' },
  { kind: 'node', name: '20261117质检通过-泽漆', status: '已废弃', tasks: '8', rate: '—', rateSub: '暂无有效评估句', createdAt: '2026-11-17 19:53' },
  { kind: 'node', name: '20261110质检通过-泽漆', status: '已废弃', tasks: '6', rate: '—', rateSub: '暂无有效评估句', createdAt: '2026-11-10 13:44' },
  { kind: 'group', name: '批次 #20261119103533_c6qxpgtt', status: '验收通过', tasks: '', rate: '' },
  { kind: 'node', name: '20261119质检通过-胡军', status: '验收通过', tasks: '39', rate: '100.00%', rateSub: '问题句 0 / 已评估 39', createdAt: '2026-11-19 10:35' },
  { kind: 'node', name: '20261119质检通过-柠檬', status: '验收通过', tasks: '12', rate: '100.00%', rateSub: '问题句 0 / 已评估 12', createdAt: '2026-11-19 10:35' },
  { kind: 'node', name: '20261119质检通过-唐舞麟', status: '验收通过', tasks: '38', rate: '100.00%', rateSub: '问题句 0 / 已评估 38', createdAt: '2026-11-19 10:35' },
  { kind: 'group', name: '批次 #20261117195340_kdey5arf', status: '已废弃', tasks: '', rate: '' },
  { kind: 'node', name: '20261117质检通过-泽漆', status: '已移出批次', tasks: '', rate: '—', rateSub: '暂无有效评估句' },
  { kind: 'group', name: '批次 #20261110134400_2cg55wkw', status: '已废弃', tasks: '', rate: '' },
  { kind: 'node', name: '20261110质检通过-泽漆', status: '已移出批次', tasks: '', rate: '—', rateSub: '暂无有效评估句' }
]

const submitCount = computed(() => selected.value.length)

function toggle(i: number) {
  selected.value = selected.value.includes(i) ? selected.value.filter((x) => x !== i) : [...selected.value, i]
}
function statusClass(s: string) {
  if (s === '验收通过') return 'green'
  if (s === '已废弃' || s === '已移出批次') return 'gray'
  if (s === '验收中') return 'blue'
  return 'gray'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>审核工作台</h1>
    </div>

    <div class="stat-grid">
      <div v-for="c in cards" :key="c.label" class="stat-card">
        <div class="label">{{ c.label }}</div>
        <div class="value">{{ c.value }}</div>
      </div>
    </div>

    <div class="panel">
      <div class="tabs tabs-count">
        <div
          v-for="t in tabs" :key="t.label" class="tab"
          :class="{ active: activeTab === t.label }" @click="activeTab = t.label"
        >
          {{ t.label }}<span class="cnt" :class="{ zero: t.count === 0 }">{{ t.count }}</span>
        </div>
      </div>

      <div class="filter-bar">
        <select v-model="annotator" class="select" style="width: 140px">
          <option>全部标注员</option>
          <option>泽漆</option><option>胡军</option><option>柠檬</option><option>唐舞麟</option>
        </select>
        <label class="chk"><input type="checkbox" /> 全选待提交</label>
        <div class="spacer"></div>
        <button class="btn sm" @click="selected = []">重置</button>
        <button class="btn sm" @click="toast('退回返修（演示）', 'info')">退回返修</button>
        <button class="btn sm danger" @click="toast('删除（演示）', 'info')">删除</button>
        <button class="btn primary sm" @click="toast('提交平台验收（演示）', 'info')">提交平台验收 {{ submitCount }}</button>
      </div>

      <div class="notice">
        模型验收功能尚未接入主系统，当前数据由 AI 表格 / 多维表维护（过渡方案），正式看板上线后自动迁移
      </div>

      <table class="table">
        <thead>
          <tr><th style="width: 42px"></th><th>批次号 · 节点名称</th><th style="width: 110px">状态</th><th style="width: 90px">任务数</th><th style="width: 180px">质检句准率</th><th style="width: 150px">创建时间</th><th style="width: 90px">操作</th></tr>
        </thead>
        <tbody>
          <template v-for="(r, i) in rows" :key="i">
            <tr v-if="r.kind === 'group'" class="group-row">
              <td></td>
              <td colspan="2"><span class="grp">{{ r.name }}</span></td>
              <td colspan="4"><span v-if="r.status" class="tag" :class="statusClass(r.status)">{{ r.status }}</span></td>
            </tr>
            <tr v-else :class="{ selected: selected.includes(i) }">
              <td><input type="checkbox" :checked="selected.includes(i)" @change="toggle(i)" /></td>
              <td class="node-name">{{ r.name }}</td>
              <td><span class="tag" :class="statusClass(r.status)">{{ r.status }}</span></td>
              <td>{{ r.tasks || '—' }}</td>
              <td>
                <div class="rate">{{ r.rate }}</div>
                <div v-if="r.rateSub" class="rate-sub">{{ r.rateSub }}</div>
              </td>
              <td class="muted">{{ r.createdAt || '—' }}</td>
              <td><button class="btn link" @click="toast('查看详情（演示）', 'info')">详情</button></td>
            </tr>
          </template>
        </tbody>
      </table>

      <div class="pager">
        <span class="muted small">第 1 / 1 页</span>
        <div class="spacer"></div>
        <button class="btn sm" disabled>上一页</button>
        <button class="btn sm" disabled>下一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
.stat-card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 14px 16px; box-shadow: var(--shadow); }
.stat-card .label { font-size: 12px; color: var(--ink-3); margin-bottom: 6px; }
.stat-card .value { font-size: 22px; font-weight: 600; font-family: var(--mono); }
.tabs-count { padding: 0 8px; overflow-x: auto; }
.tabs-count .tab { white-space: nowrap; }
.cnt { margin-left: 5px; font-size: 11px; color: var(--ink-2); background: #f2f3f5; border-radius: 8px; padding: 0 5px; }
.cnt.zero { color: var(--ink-4); }
.filter-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.spacer { flex: 1; }
.small { font-size: 12px; }
.chk { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-2); }
.chk input { accent-color: var(--primary); }
.notice { padding: 8px 16px; font-size: 11px; color: #b26a00; background: #fffbe6; border-bottom: 1px solid #fff1b8; }
.group-row td { background: #fafbfc; }
.grp { font-size: 12px; font-weight: 600; color: var(--ink-1); }
.node-name { padding-left: 26px !important; color: var(--ink-1); }
.rate { font-size: 12px; }
.rate-sub { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
.danger { color: var(--danger); border-color: #f6c6c2; }
.pager { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
tbody input[type=checkbox] { accent-color: var(--primary); }
</style>
