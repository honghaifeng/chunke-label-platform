<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'
</script>

<template>
  <div class="page wb">
    <div class="page-head">
      <h1><Icon name="shield" :size="22" color="#10b981" />长音频质检工作台</h1>
      <span class="sub">从待质检池点「开始质检」认领任务；认领后归属于你，草稿实时保存，下次进入可继续。</span>
      <div class="head-actions">
        <button class="btn" @click="toast('已刷新', 'info')"><Icon name="refresh" :size="13" />刷新</button>
      </div>
    </div>

    <div class="wb-title">待质检任务池</div>
    <div class="rv-search-row">
      <div class="rv-search">
        <Icon name="search" :size="14" color="#8a919f" />
        <input placeholder="输入任务 ID 搜索" />
      </div>
      <button class="btn primary" @click="toast('未找到匹配的待质检任务', 'info')">搜索</button>
    </div>

    <div class="rv-empty">
      <Icon name="mailOpen" :size="24" color="#9ca3af" />
      <span>暂无待质检任务</span>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 896px; margin: -24px auto 0; padding: 16px; }
.page-head { margin: 0 0 15px; padding: 0; background: transparent; border-bottom: none; position: relative; display: block; }
.page-head h1 { display: flex; align-items: center; gap: 8px; width: auto; font-size: 18px; }
.page-head .sub { display: block; font-size: 12px; margin-top: 16px; }
.page-head .head-actions { position: absolute; right: 0; top: 0; display: flex; gap: 8px; }
.page-head .head-actions .btn { height: 28px; padding: 0 10px; border-radius: 4.8px; font-size: 12.8px; }
.wb-title { font-size: 14px; font-weight: 500; color: #111827; margin: 0 0 8px; }
.rv-search-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.rv-search {
  display: flex; align-items: center; gap: 8px; flex: 1; height: 32px; padding: 0 10px;
  border: 1px solid #e5e7eb; border-radius: 6px; background: #fff;
}
.rv-search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; color: #1e293b; }
.rv-search-row .btn { height: 28px; width: 48px; padding: 0; justify-content: center; font-size: 12.8px; border-radius: 4.8px; }
.rv-empty {
  height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 0 16px; border: 1px dashed #e5e7eb; border-radius: 8px; background: transparent; font-size: 14px; color: #6b7280;
}
</style>
