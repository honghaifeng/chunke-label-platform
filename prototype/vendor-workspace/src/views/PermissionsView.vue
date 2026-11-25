<script setup lang="ts">
import { ref } from 'vue'
import { db } from '@/mock'

const highlight = ref('组织管理员')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>权限矩阵</h1>
      <span class="sub">34 个权限点 × 5 个角色（平台组权限在供应商侧为空）</span>
      <div class="spacer"></div>
      <select v-model="highlight" class="select">
        <option v-for="r in db.roleNames" :key="r">{{ r }}</option>
      </select>
    </div>

    <div class="panel" style="overflow: auto">
      <table class="table perm">
        <thead>
          <tr>
            <th style="width: 90px">分组</th>
            <th style="width: 210px">权限点</th>
            <th v-for="r in db.roleNames" :key="r" :class="{ hl: r === highlight }">{{ r }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in db.permissions" :key="p.code">
            <td class="muted">{{ p.group }}</td>
            <td>
              <div>{{ p.label }}</div>
              <div class="mono muted" style="font-size: 11px">{{ p.code }}</div>
            </td>
            <td v-for="r in db.roleNames" :key="r" :class="{ hl: r === highlight }" style="text-align: center">
              <span v-if="p.roles[r]" class="yes">✓</span>
              <span v-else class="no">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="muted" style="margin-top: 10px; font-size: 12px">
      组织管理员拥有全部组织内权限；项目经理可管理项目与任务分配；标注员 / 质检员 / 验收员仅拥有对应作业权限。
    </div>
  </div>
</template>

<style scoped>
.perm th.hl, .perm td.hl { background: #fff7f6; }
.perm thead th { position: sticky; top: 0; z-index: 1; }
.yes { color: var(--success); font-weight: 700; }
.no { color: var(--ink-4); }
</style>
