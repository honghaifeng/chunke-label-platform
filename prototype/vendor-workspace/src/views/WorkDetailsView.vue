<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/mock'
import Icon from '@/components/Icon.vue'

const tab = ref<'annotate' | 'qc'>('annotate')
const page = ref(1)
const members = [
  { name: '泽漆', roles: ['标注员', '质检员'] },
  { name: '唐舞麟', roles: ['标注员', '质检员'] },
  { name: '柠檬', roles: ['标注员', '质检员'] },
  { name: '胡军', roles: ['标注员', '质检员'] }
]
const activeMember = ref('泽漆')

const rows = computed(() =>
  db.tasks.filter((t) => t.assignee === activeMember.value).slice(0, 5)
)

function versionOf(id: number) {
  return id === 11074116 ? 13 : 1 + (id % 3)
}
function spentOf(id: number, duration: number) {
  if (id === 11074116) return '118m50s'
  const m = Math.floor(duration / 60)
  return `${m}m${duration % 60}s`
}
function annotatedAt(id: number) {
  return id === 11074116 ? '2026年11月14日 20:09' : '2026年11月14日 20:09'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>长音频标注和质检明细</h1>
      <span class="sub">按成员查看长音频拉框标注与段级质检明细</span>
    </div>

    <div class="detail-layout">
      <div class="panel left">
        <div class="search">
          <Icon name="search" :size="14" color="#9ca3af" />
          <input placeholder="搜索成员" />
        </div>
        <div class="member-count">共 4 名成员</div>
        <div class="member-list">
          <button
            v-for="m in members"
            :key="m.name"
            class="member"
            :class="{ on: activeMember === m.name }"
            @click="activeMember = m.name"
          >
            <span class="avatar">{{ m.name.slice(0, 1) }}</span>
            <span class="info">
              <span class="name">{{ m.name }}</span>
              <span class="roles">
                <span class="role">{{ m.roles[0] }}</span>
                <span class="role">{{ m.roles[1] }}</span>
              </span>
            </span>
          </button>
        </div>
        <div class="left-pager">
          <span class="muted">第 1/1 页 · 共 4 条</span>
          <div class="spacer"></div>
          <button class="page-btn" disabled>上一页</button>
          <button class="page-btn" disabled>下一页</button>
        </div>
      </div>

      <div class="right">
        <div class="seg">
          <button :class="{ on: tab === 'annotate' }" @click="tab = 'annotate'">标注明细</button>
          <button :class="{ on: tab === 'qc' }" @click="tab = 'qc'">质检明细</button>
        </div>

        <div class="panel table-card">
          <table class="table">
            <thead>
              <tr>
                <th class="chev" style="width: 32px"></th>
                <th style="width: 98px">任务 ID</th><th style="width: 83px">状态</th><th style="width: 62px">总段数</th><th style="width: 76px">已确认段</th>
                <th style="width: 47px">版本</th><th style="width: 91px">耗时</th><th style="width: 165px">标注时间</th><th>更新时间</th>
              </tr>
            </thead>
            <tbody v-if="rows.length">
              <tr v-for="t in rows" :key="t.id">
                <td class="chev"><Icon name="chevronRight" :size="14" color="#6b7280" /></td>
                <td class="linkish">#{{ t.id }}</td>
                <td><span class="status-done">已质检</span></td>
                <td>{{ t.segments.length }}</td>
                <td>{{ t.segments.length }}</td>
                <td>{{ versionOf(t.id) }}</td>
                <td>{{ spentOf(t.id, t.duration) }}</td>
                <td class="muted">{{ annotatedAt(t.id) }}</td>
                <td class="muted">{{ t.updatedAt || '—' }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr><td colspan="9" class="cell-empty">{{ tab === 'annotate' ? '暂无标注明细' : '暂无质检明细' }}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="pager">
          <span class="muted">第 {{ page }}/1 页 · 共 {{ rows.length }} 条</span>
          <button class="page-btn" disabled>上一页</button>
          <button class="page-btn" disabled>下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-layout { display: grid; grid-template-columns: 278px minmax(0, 1fr); gap: 18px; align-items: stretch; padding: 8px 8px 0; }
.left { display: flex; flex-direction: column; min-height: calc(100vh - 166px); overflow: hidden; }
.search {
  display: flex; align-items: center; gap: 8px; height: 36px; margin: 12px 12px 0; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; }
.member-count { padding: 8px 12px 12px; font-size: 12px; color: var(--ink-3); border-bottom: 1px solid #f1f5f9; }
.member-list { flex: 1; overflow: auto; }
.member {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 62px; padding: 10px 12px;
  border: none; border-bottom: 1px solid #f3f4f6; background: #fff; cursor: pointer; text-align: left;
  font-family: inherit;
}
.member:hover { background: #f8fafc; }
.member.on { background: rgba(59, 130, 246, .1); }
.avatar {
  width: 36px; height: 36px; border-radius: 50%; background: #f3f4f6; color: #6b7280;
  display: grid; place-items: center; font-size: 14px; font-weight: 500; flex: 0 0 36px;
}
.member.on .avatar { background: #3b82f6; color: #fff; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.name { font-size: 14px; font-weight: 500; color: var(--ink-1); }
.roles { display: flex; gap: 4px; }
.role {
  font-size: 10px; color: #6b7280; background: #f3f4f6; border-radius: 4px; padding: 2px 6px;
  line-height: 16px;
}
.left-pager { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-top: 1px solid var(--line); font-size: 12px; }
.spacer { flex: 1; }
.seg { display: inline-flex; align-items: center; gap: 0; margin-bottom: 24px; padding: 4px; background: #f3f4f6; border-radius: 6px; }
.seg button {
  height: 32px; padding: 0 12px; border: none; border-radius: 5px; background: transparent;
  color: #6b7280; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
}
.seg button.on { background: #f9fafb; color: var(--ink-1); box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
.table-card { padding: 0; overflow: hidden; border-radius: 8px; }
.table { width: 100%; border-collapse: collapse; }
.table th {
  height: 40px; background: #f8fafc; padding: 0 8px; font-size: 12px; font-weight: 500;
  color: #111827; text-align: left; white-space: nowrap;
}
.table td { height: 37.5px; padding: 0 8px; font-size: 14px; color: #1e293b; white-space: nowrap; }
.table tbody tr:last-child td { border-bottom: none; }
.table .chev { width: 32px; padding: 0 0 0 12px; }
.table th.chev { padding-left: 12px; }
.linkish { color: #111827; font-weight: 600; }
.muted { color: #6b7280; }
.cell-empty { text-align: center; color: var(--ink-3); padding: 32px 0 !important; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 0 0; font-size: 13px; }
.status-done {
  display: inline-flex; align-items: center; height: 20px; padding: 2px 10px; border-radius: 999px;
  background: rgba(16, 185, 129, .1); color: #059669; font-size: 12px; font-weight: 500;
}
.page-btn {
  height: 28px; padding: 0 10px; border: 1px solid var(--line); border-radius: 4.8px; background: #fff;
  color: #cbd5e1; font-size: 12.8px; font-family: inherit; cursor: pointer;
}
.page-btn:disabled { color: #cbd5e1; cursor: not-allowed; }
</style>
