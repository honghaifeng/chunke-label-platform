<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/mock'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const depts = ref<{ name: string; count: number }[]>([])
const name = ref('')
const active = ref('')

const activeMembers = computed(() =>
  active.value ? db.members.filter((m) => m.dept === active.value).slice(0, 10) : []
)

function add() {
  const v = name.value.trim()
  if (!v) return
  if (depts.value.some((d) => d.name === v)) return toast('部门已存在', 'err')
  depts.value.push({ name: v, count: 0 })
  name.value = ''
  toast('部门已创建（演示）', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>部门管理</h1>
      <span class="sub">管理组织的部门结构与层级关系</span>
    </div>

    <div class="layout">
      <div class="panel">
        <div class="panel-head">
          <Icon name="folder" :size="15" color="#94a3b8" />
          <h2>部门结构</h2>
        </div>
        <div class="tree">
          <div v-for="d in depts" :key="d.name" class="tree-item" :class="{ active: active === d.name }" @click="active = d.name">
            <Icon name="folder" :size="14" color="#94a3b8" />
            <span>{{ d.name }}</span>
            <span class="count">{{ d.count }}</span>
          </div>
          <div v-if="!depts.length" class="tree-empty">
            <div class="empty-ico"><Icon name="folder" :size="22" color="#60a5fa" /></div>
            <p class="t1">暂无部门</p>
            <p class="t2">使用下方输入框创建第一个部门。</p>
          </div>
        </div>
        <div class="create-bar">
          <input v-model="name" class="input" placeholder="新部门名称" @keydown.enter.prevent="add" />
          <button class="btn primary" @click="add">添加</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <Icon name="users" :size="15" color="#94a3b8" />
          <h2>成员列表</h2>
        </div>
        <div v-if="!active" class="empty">
          <div class="empty-ico"><Icon name="clipboard" :size="22" color="#94a3b8" /></div>
          <p class="empty-title">请从左侧选择部门</p>
        </div>
        <table v-else class="table">
          <thead><tr><th>成员</th><th>角色</th><th>子组织</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="m in activeMembers" :key="m.id">
              <td>{{ m.name }}</td>
              <td>{{ m.role }}</td>
              <td>{{ m.subOrg }}</td>
              <td><span class="tag green dot">{{ m.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: stretch; }
.tree { min-height: 228px; }
.tree-item { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; font-size: 14px; color: var(--ink-2); cursor: pointer; }
.tree-item:hover { background: #f8fafc; }
.tree-item.active { background: var(--primary-weak); color: var(--primary); }
.tree-item .count { margin-left: auto; font-size: 12px; color: var(--ink-3); }
.tree-empty { padding: 22px 12px 28px; text-align: center; }
.empty-ico { width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 12px; background: #eff6ff; display: grid; place-items: center; }
.t1 { font-size: 14px; font-weight: 600; color: var(--ink-1); margin: 0 0 6px; }
.t2 { font-size: 12px; color: var(--ink-3); margin: 0; }
.create-bar { display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--line); }
.create-bar .input { flex: 1; }
.empty { min-height: 290px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-title { font-size: 14px; color: var(--ink-3); margin: 0; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
</style>
