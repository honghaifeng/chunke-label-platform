<script setup lang="ts">
import { ref } from 'vue'

const publish = ref<'draft' | 'published' | 'all'>('draft')
const validity = ref('全部')
const sortByCer = ref(false)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>错题管理</h1>
    </div>

    <div class="panel">
      <div class="filter-bar">
        <div class="pill-tabs">
          <div :class="{ on: publish === 'draft' }" @click="publish = 'draft'">未发布</div>
          <div :class="{ on: publish === 'published' }" @click="publish = 'published'">已发布</div>
          <div :class="{ on: publish === 'all' }" @click="publish = 'all'">全部</div>
        </div>
        <select v-model="validity" class="select" style="width: 120px">
          <option>全部</option><option>有效</option><option>无效</option>
        </select>
        <div class="spacer"></div>
        <button class="btn sm" :class="{ 'btn-active': sortByCer }" @click="sortByCer = !sortByCer">按 CER 排序</button>
      </div>

      <div class="empty">
        <p class="empty-title">暂无错题数据</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.spacer { flex: 1; }
.btn-active { color: var(--primary); border-color: var(--primary-border); background: var(--primary-weak); }
.empty { padding: 56px 16px 64px; text-align: center; border-top: 1px solid var(--line); }
.empty-title { font-size: 13px; color: var(--ink-3); margin: 0; }
</style>
