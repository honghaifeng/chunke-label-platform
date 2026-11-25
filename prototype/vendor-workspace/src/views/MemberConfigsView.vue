<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/mock'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const q = ref('')
const project = ref('全部项目')
const dept = ref('全部部门')
const status = ref('全部状态')
const page = ref(1)

const rows = computed(() =>
  db.members
    .filter((m) => (q.value ? m.name.includes(q.value) || m.id.includes(q.value) : true))
    .filter((m) => (dept.value === '全部部门' ? true : false))
    .filter((m) => (status.value === '全部状态' ? true : status.value === '已配置'))
)

function reset() {
  q.value = ''
  project.value = '全部项目'
  dept.value = '全部部门'
  status.value = '全部状态'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>成员配置总览</h1>
      <span class="sub">查看组织内所有成员的语音、地域背景与个人配置</span>
      <div class="head-actions">
        <span class="count">共 {{ db.members.length }} 位用户</span>
        <button class="btn" @click="toast('已导出 Excel（演示）', 'ok')">
          <Icon name="download" :size="13" color="#4b5563" />
          导出 Excel
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="filter-bar">
        <div class="fld">
          <label>搜索成员</label>
          <div class="search-box">
            <Icon name="search" :size="14" color="#9ca3af" />
            <input v-model="q" placeholder="搜索成员" />
          </div>
        </div>
        <div class="fld">
          <label>项目</label>
          <select v-model="project" class="select">
            <option>全部项目</option>
            <option v-for="p in db.projects" :key="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="fld">
          <label>部门</label>
          <select v-model="dept" class="select">
            <option>全部部门</option>
          </select>
        </div>
        <div class="fld">
          <label>成员状态</label>
          <select v-model="status" class="select">
            <option>全部状态</option>
            <option>已配置</option>
            <option>未配置</option>
          </select>
        </div>
        <button class="btn reset-btn" @click="reset">
          <Icon name="refresh" :size="13" color="#4b5563" />
          重置筛选
        </button>
      </div>

      <div class="hint-bar">项目与部门同时选择时取交集；包含未保存配置及停用成员。</div>

      <table class="table">
        <thead>
          <tr>
            <th style="width: 18%">成员</th><th style="width: 13%">部门</th><th style="width: 11%">语言 / 方言</th>
            <th style="width: 12%">地域背景</th><th style="width: 12%">出生地</th><th style="width: 12%">性别 / 年龄段</th>
            <th style="width: 10%">配置状态</th><th style="width: 9%">修改时间</th><th style="width: 6%">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in rows" :key="m.id">
            <td>
              <div class="who">
                <div class="nm">{{ m.name }}</div>
                <div class="uid">{{ m.id }}</div>
              </div>
            </td>
            <td class="muted">未分配部门</td>
            <td class="muted">—</td>
            <td class="muted">未填写</td>
            <td class="muted">—</td>
            <td class="muted">—</td>
            <td><span class="tag gray">未配置</span></td>
            <td class="muted">—</td>
            <td>
              <div class="op-icons">
                <button title="查看" @click="toast('查看成员配置（演示）', 'info')"><Icon name="eye" :size="14" color="#6b7280" /></button>
                <button title="编辑" @click="toast('编辑成员配置（演示）', 'info')"><Icon name="tool" :size="14" color="#6b7280" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <span class="muted">共 {{ rows.length }} 条记录</span>
        <div class="pager-btns">
          <button class="btn sm" :disabled="page <= 1" @click="page--">上一页</button>
          <span class="muted">{{ page }} / 1</span>
          <button class="btn sm" disabled>下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.count { font-size: 12px; color: var(--ink-3); }
.head-actions { display: flex; align-items: center; gap: 12px; }
.filter-bar { display: flex; align-items: flex-end; gap: 16px; padding: 16px 20px 12px; }
.fld { display: flex; flex-direction: column; gap: 6px; }
.fld > label { font-size: 12px; color: var(--ink-3); }
.search-box {
  display: flex; align-items: center; gap: 8px; height: 32px; width: 236px; padding: 0 10px;
  border: 1px solid var(--line-strong); border-radius: 6px; background: #fff;
}
.search-box input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; min-width: 0; }
.select { height: 32px; width: 142px; }
.reset-btn { margin-left: auto; }
.hint-bar { padding: 0 20px 10px; font-size: 12px; color: var(--ink-3); }
.who .nm { font-size: 14px; font-weight: 500; color: var(--ink-1); }
.who .uid { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
.op-icons { display: flex; gap: 8px; }
.op-icons button { border: none; background: none; padding: 2px; cursor: pointer; border-radius: 4px; display: grid; place-items: center; }
.op-icons button:hover { background: #f3f4f6; }
.pager { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; font-size: 12px; }
.pager-btns { display: flex; align-items: center; gap: 10px; }
</style>
