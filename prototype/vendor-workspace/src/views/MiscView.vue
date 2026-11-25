<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '@/mock'
import { pages } from '@/mock/pages'
import DataTable from '@/components/DataTable.vue'
import StatCard from '@/components/StatCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import { toast } from '@/composables/toast'

const route = useRoute()
const key = computed(() => String(route.meta.pageKey || ''))
const config = computed(() => pages[key.value])

const search = ref('')
const roleFilter = ref('全部角色')
const statusFilter = ref('全部状态')
const deptFilter = ref('全部部门')

const statuses = computed(() => Array.from(new Set((config.value?.rows || []).map((r) => r.status).filter(Boolean))))
const depts = computed(() => Array.from(new Set((config.value?.rows || []).map((r) => r.dept).filter(Boolean))))

const rows = computed(() => {
  let list = config.value?.rows || []
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
  }
  if (roleFilter.value !== '全部角色') list = list.filter((r) => r.role === roleFilter.value)
  if (statusFilter.value !== '全部状态') list = list.filter((r) => r.status === statusFilter.value)
  if (deptFilter.value !== '全部部门') list = list.filter((r) => r.dept === deptFilter.value)
  return list
})

const columns = computed(() => config.value?.columns || [])
</script>

<template>
  <div v-if="config" class="page">
    <div class="page-head">
      <h1>{{ config.title }}</h1>
      <span v-if="config.sub" class="sub">{{ config.sub }}</span>
      <div class="spacer"></div>
      <button v-for="b in config.buttons" :key="b" class="btn" @click="toast(`${b}（演示占位）`, 'info')">{{ b }}</button>
    </div>

    <div v-if="config.stats" class="stat-row">
      <StatCard
        v-for="s in config.stats"
        :key="s.label"
        :label="s.label"
        :value="s.value"
        :unit="s.unit"
        :accent="s.accent"
      />
    </div>

    <div class="panel">
      <div v-if="config.filters?.length" class="filter-bar">
        <input v-if="config.filters.includes('search')" v-model="search" class="input" placeholder="搜索" style="width: 190px" />
        <select v-if="config.filters.includes('role')" v-model="roleFilter" class="select">
          <option>全部角色</option>
          <option v-for="r in db.roleNames" :key="r">{{ r }}</option>
        </select>
        <select v-if="config.filters.includes('status')" v-model="statusFilter" class="select">
          <option>全部状态</option>
          <option v-for="s in statuses" :key="s">{{ s }}</option>
        </select>
        <select v-if="config.filters.includes('dept')" v-model="deptFilter" class="select">
          <option>全部部门</option>
          <option v-for="d in depts" :key="d">{{ d }}</option>
        </select>
        <span class="muted" style="font-size: 12px">共 {{ rows.length }} 条</span>
      </div>

      <DataTable :columns="columns" :rows="rows">
        <template #status="{ row }"><StatusTag :text="row.status" /></template>
        <template #ai="{ row }"><StatusTag :text="row.ai" /></template>
        <template #platform="{ row }"><StatusTag :text="row.platform" /></template>
        <template #model="{ row }"><StatusTag :text="row.model" /></template>
      </DataTable>

      <div v-if="config.note" class="note">{{ config.note }}</div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.note { padding: 10px 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-3); background: #fafbfc; }
</style>
