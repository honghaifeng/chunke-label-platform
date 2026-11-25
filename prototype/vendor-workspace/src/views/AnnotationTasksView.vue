<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { db, fmtDuration } from '@/mock'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const pid = computed(() => Number(route.params.pid || 0))
const status = ref('all')
const q = ref('')
const refreshAt = ref('')
const page = ref(1)
const checked = ref<number[]>([])

const list = computed(() => {
  let rows = db.tasks.filter((t) => t.projectId === pid.value).slice().sort((a, b) => b.id - a.id)
  if (status.value !== 'all') rows = rows.filter((t) => t.status === status.value)
  if (q.value) rows = rows.filter((t) => String(t.id).includes(q.value.trim()))
  return rows
})

const view = computed(() =>
  list.value.map((t) => {
    const total = t.segments.length
    const pending = t.segments.filter((s) => s.status === 'pending').length
    const passed = t.segments.filter((s) => s.status === 'passed').length
    const rejected = t.segments.filter((s) => s.status === 'rejected').length
    const label = rejected > 0 ? '已退回' : passed > 0 ? '质检通过' : t.status
    return { ...t, total, annotated: total - pending, passed, rejected, label }
  })
)

function statusTag(s: string) {
  if (s === '待领取') return 'gray'
  if (s === '标注中') return 'blue'
  if (s === '待质检') return 'orange'
  if (s === '质检中') return 'purple'
  if (s === '质检通过') return 'passed'
  if (s === '已通过') return 'passed'
  if (s === '已退回') return 'red'
  return 'gray'
}
function refresh() {
  refreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  toast('任务列表已刷新（演示）', 'info')
}
function toggle(id: number) {
  checked.value = checked.value.includes(id) ? checked.value.filter((x) => x !== id) : [...checked.value, id]
}
function toggleAll() {
  checked.value = checked.value.length === view.value.length ? [] : view.value.map((t) => t.id)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>长音频标注任务</h1>
      <span class="sub">查看长音频拉框任务的标注与质检进度</span>
      <div class="spacer"></div>
      <div class="head-actions">
        <button class="btn" @click="toast('任务释放（演示）', 'info')">任务释放</button>
        <button class="btn" @click="$router.push(`/vendor/projects/${pid}/allocate`)">任务分配</button>
        <button class="btn" @click="toast('质检分配（演示）', 'info')">质检分配</button>
      </div>
    </div>

    <div class="page-body">
      <div class="filterbar">
        <div class="search">
          <Icon name="search" :size="14" color="#9ca3af" />
          <input v-model="q" placeholder="按任务 ID 搜索，回车确认" @keydown.enter.prevent="refresh" />
        </div>
        <div class="sel-wrap">
          <select v-model="status">
            <option value="all">all</option>
            <option value="待领取">待领取</option>
            <option value="标注中">标注中</option>
            <option value="待质检">待质检</option>
            <option value="质检中">质检中</option>
            <option value="已通过">质检通过</option>
            <option value="已退回">已退回</option>
          </select>
          <Icon name="caretUpDown" :size="14" color="#9ca3af" />
        </div>
        <button class="btn refresh-btn" @click="refresh"><Icon name="refresh" :size="13" />刷新</button>
        <div class="spacer"></div>
        <span v-if="refreshAt" class="muted small">更新于 {{ refreshAt }}</span>
      </div>

      <div class="panel table-card">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 48px; padding-left: 8px"><input type="checkbox" :checked="checked.length === view.length && view.length > 0" @change="toggleAll" /></th>
              <th style="width: 189px">任务 ID</th><th style="width: 76px">时长</th><th style="width: 117px">状态</th>
              <th style="width: 165px">标注进度</th><th style="width: 138px">质检进度</th>
              <th style="width: 82px">标注员</th><th style="width: 100px">质检员</th><th style="width: 196px">更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in view" :key="t.id">
              <td style="padding-left: 8px"><input type="checkbox" :checked="checked.includes(t.id)" @change="toggle(t.id)" /></td>
              <td class="id-cell">
                <span class="linkish">#{{ t.id }}</span>
                <span v-if="t.rework" class="rework-tag">返修</span>
              </td>
              <td>{{ fmtDuration(t.duration) }}</td>
              <td>
                <span v-if="t.label === '待领取'" class="plain">{{ t.label }}</span>
                <span v-else class="tag" :class="statusTag(t.label)">{{ t.label }}</span>
              </td>
              <td>已标注 {{ t.annotated }}/{{ t.total }} 段</td>
              <td class="nowrap">
                <template v-if="t.passed > 0 || t.rejected > 0">
                  <span class="ok">通过 {{ t.passed }}</span>
                  <span class="no">拒绝 {{ t.rejected }}</span>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ t.assignee || '—' }}</td>
              <td>{{ t.qcNode || '—' }}</td>
              <td class="muted nowrap">{{ t.updatedAt || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <span class="muted small">第 {{ page }} 页</span>
        <button class="page-btn" :disabled="page <= 1" @click="page--">上一页</button>
        <button class="page-btn" disabled>下一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head-actions { display: flex; gap: 8px; }
.head-actions .btn { height: 32px; font-size: 14px; }
.page-body { padding: 8px 8px 0; }
.filterbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.search {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; width: 219px;
  border: 1px solid var(--line); border-radius: 6px; color: var(--ink-3); background: #fff;
}
.search:focus-within { border-color: var(--primary); }
.search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; }
.sel-wrap {
  position: relative; display: flex; align-items: center; width: 170px; height: 32px; padding: 0 26px 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.sel-wrap select {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent; appearance: none;
  font-size: 14px; font-family: inherit; color: var(--ink-1); cursor: pointer;
}
.sel-wrap > svg { position: absolute; right: 8px; pointer-events: none; }
.refresh-btn { height: 36px; padding: 0 10px; font-size: 12.8px; background: #f9fafb; }
.spacer { flex: 1; }
.small { font-size: 12px; }
.table-card { padding: 0; overflow: hidden; border-radius: 8px; }
.table th { padding: 0 8px; }
.table th:first-child { padding-left: 8px; }
.table td { height: 38px; padding: 0 8px; }
.table td:first-child { padding-left: 8px; }
.id-cell { white-space: nowrap; }
.linkish { color: #111827; font-weight: 600; }
.rework-tag {
  display: inline-flex; align-items: center; height: 18px; margin-left: 6px; padding: 0 4px; border-radius: 4px;
  border: 1px solid #fecaca; background: #fef2f2; color: #ef4444; font-size: 10px; font-weight: 500;
}
.plain { color: var(--ink-2); }
.tag.passed { background: #ecfdf5; color: #059669; }
.nowrap { white-space: nowrap; }
.ok { color: #10b981; margin-right: 10px; }
.no { color: #ef4444; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 12px 0 0; font-size: 12px; }
.page-btn {
  height: 28px; padding: 0 10px; border: 1px solid var(--line); border-radius: 4.8px; background: #f9fafb;
  color: var(--ink-1); font-size: 12.8px; font-family: inherit; cursor: pointer;
}
.page-btn:disabled { color: #cbd5e1; cursor: not-allowed; }
tbody input[type=checkbox] { accent-color: var(--primary); }
</style>
