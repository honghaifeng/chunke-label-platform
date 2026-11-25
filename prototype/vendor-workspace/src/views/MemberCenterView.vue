<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/mock'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const treeSelected = ref<'all' | string>('all')
const tab = ref<'active' | 'disabled'>('active')
const keyword = ref('')
const idKeyword = ref('')

const list = computed(() => {
  let rows = db.members
  if (tab.value === 'active') rows = rows.filter((m) => m.status === '活跃')
  else rows = rows.filter((m) => m.status === '停用')
  if (keyword.value) rows = rows.filter((m) => m.name.includes(keyword.value) || m.account.includes(keyword.value))
  if (idKeyword.value) rows = rows.filter((m) => String(m.id).includes(idKeyword.value))
  return rows
})

const activeCount = computed(() => db.members.filter((m) => m.status === '活跃').length)
const disabledCount = computed(() => db.members.filter((m) => m.status === '停用').length)

function action(name: string, member: string) {
  toast(`${name}：${member}（演示）`, 'info')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>成员管理</h1>
      <span class="sub">查看当前组织及所有下级组织的成员</span>
    </div>

    <div class="two-col">
      <div class="card side-card">
        <div class="card-head"><Icon name="users" :size="14" color="#4e5969" />组织结构<span class="spacer"></span><Icon name="chevronLeft" :size="12" color="#8a919f" /></div>
        <div class="tree">
          <div class="tree-item" :class="{ active: treeSelected === 'all' }" @click="treeSelected = 'all'">
            <span class="tree-icon"><Icon name="users" :size="13" :color="treeSelected === 'all' ? '#1677ff' : '#8a919f'" /></span>
            <span>全部成员</span>
            <span class="count">(27)</span>
          </div>
          <div class="tree-item" :class="{ active: treeSelected === 'org' }" style="padding-left: 24px" @click="treeSelected = 'org'">
            <span class="tree-icon"><Icon name="home" :size="13" :color="treeSelected === 'org' ? '#1677ff' : '#8a919f'" /></span>
            <span>杭州春客</span>
            <span class="count">(27)</span>
          </div>
        </div>
      </div>

      <div class="card right-card">
        <div class="mc-top">
          <div class="sel-label">选中组织：<b>{{ treeSelected === 'all' ? '全部成员' : '杭州春客' }}</b> <span class="muted">({{ tab === 'active' ? activeCount : disabledCount }})</span></div>
          <div class="spacer"></div>
          <div class="search-box">
            <Icon name="search" :size="13" color="#8a919f" />
            <input v-model="keyword" placeholder="搜索昵称或账号 ID..." />
          </div>
          <div class="search-box wide">
            <Icon name="search" :size="13" color="#8a919f" />
            <input v-model="idKeyword" placeholder="按成员 ID（annotator_id）搜" />
          </div>
        </div>

        <div class="mc-tabs">
          <div class="pill-tabs">
            <div :class="{ on: tab === 'active' }" @click="tab = 'active'">活跃账号</div>
            <div :class="{ on: tab === 'disabled' }" @click="tab = 'disabled'">停用</div>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>昵称</th>
              <th>联系方式</th>
              <th>所属组织</th>
              <th>角色</th>
              <th>语种全量录音时长</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in list" :key="m.id">
              <td>{{ m.id }}</td>
              <td>{{ m.name }}</td>
              <td class="muted ell" :title="m.phone">{{ m.phone }}</td>
              <td class="muted ell" title="杭州春客">杭州春客</td>
              <td>{{ m.orgRole }}</td>
              <td class="muted">{{ m.recording }}</td>
              <td><span class="tag green dot">{{ m.status }}</span></td>
              <td class="ops">
                <button class="btn ghost sm" title="重置密码" @click="action('重置密码', m.name)">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3">
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                </button>
                <button class="btn ghost sm" title="查看任务" @click="action('查看任务', m.name)">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3">
                    <path d="M2 4.5h4l1.2 1.5H14v6.5H2z" />
                  </svg>
                </button>
                <button class="btn ghost sm" title="成员详情" @click="action('成员详情', m.name)">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3">
                    <circle cx="8" cy="5.5" r="2.3" />
                    <path d="M3.5 13c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
                  </svg>
                </button>
              </td>
            </tr>
            <tr v-if="!list.length">
              <td colspan="8"><div class="empty">没有符合条件的成员</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.two-col { display: grid; grid-template-columns: 184px minmax(0, 1fr); gap: 16px; align-items: stretch; }
.side-card { min-height: 0; }
.right-card { display: flex; flex-direction: column; min-width: 0; }
.mc-top { display: flex; align-items: center; gap: 10px; padding: 14px 16px 4px; flex-wrap: wrap; }
.sel-label { font-size: 12px; color: var(--ink-3); }
.sel-label b { color: var(--ink-1); font-weight: 600; }
.mc-top .spacer { flex: 1; }
.search-box { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line-strong); border-radius: 4px; height: 28px; padding: 0 8px; color: var(--ink-3); }
.search-box input { border: none; outline: none; font-size: 12px; width: 130px; font-family: inherit; background: transparent; }
.search-box input::placeholder { color: var(--ink-4); }
.search-box.wide input { width: 196px; }
.mc-tabs { padding: 6px 16px 10px; }
.mc-tabs .pill-tabs > div { padding: 4px 12px; font-size: 12px; }
.right-card .table { border-top: 1px solid var(--line); }
.right-card .table th { padding: 9px 8px; white-space: nowrap; }
.right-card .table td { padding: 10px 8px; white-space: nowrap; }
.right-card .table th:first-child, .right-card .table td:first-child { padding-left: 16px; }
.ell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.right-card .table td.ell { max-width: 78px; }
.ops { white-space: nowrap; }
.ops .btn { padding: 0 4px; margin-right: 2px; }
.ops svg { display: block; }
</style>
