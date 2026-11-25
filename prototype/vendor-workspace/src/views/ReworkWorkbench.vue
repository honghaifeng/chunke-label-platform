<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const route = useRoute()
const pid = computed(() => Number(route.params.pid))

const keyword = ref('')
const reason = ref('all')

function continuous() {
  toast('当前没有分配给你的待返修任务', 'info')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>返修工作台</h1>
      <span class="sub">集中修复分配给我的返修任务，可按顺序连续作业。</span>
    </div>

    <div class="rw-card">
      <div class="rw-toolbar">
        <div class="rw-search">
          <Icon name="search" :size="14" color="#8a919f" />
          <input v-model="keyword" placeholder="按任务 ID 搜索" />
        </div>
        <div class="rw-sel">
          <span>{{ reason }}</span>
          <Icon name="caretUpDown" :size="13" color="#8a919f" />
        </div>
        <button class="btn rw-refresh" @click="toast('已刷新', 'info')"><Icon name="refresh" :size="13" />刷新</button>
        <button class="btn primary rw-primary" @click="continuous"><Icon name="play" :size="12" color="#fff" />连续返修</button>
      </div>

      <div class="rw-tablewrap">
        <table class="rw-table">
          <thead>
            <tr>
              <th style="width: 138px">任务</th>
              <th style="width: 222px">返修方式</th>
              <th style="width: 138px">来源</th>
              <th>返修原因</th>
              <th style="width: 222px">返修次数</th>
              <th style="width: 138px; text-align: right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6" class="rw-empty">当前没有待返修任务</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rw-foot">
        <span>共 0 条</span>
        <div class="spacer"></div>
        <button class="page-btn" disabled>上一页</button>
        <span class="pg">1 / 1</span>
        <button class="page-btn" disabled>下一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head { margin: -24px -24px 24px; border-bottom: none; position: sticky; top: -24px; z-index: 5; }
.rw-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 40px 24px 36px; margin: 48px 0 0; }
.rw-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.rw-search {
  display: flex; align-items: center; gap: 8px; flex: 1; height: 32px; padding: 0 10px;
  border: 1px solid #e5e7eb; border-radius: 6px; background: #fff;
}
.rw-search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; color: #1e293b; }
.rw-sel {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 208px; height: 32px;
  padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; color: #1e293b;
  background: #fff; cursor: pointer;
}
.rw-refresh { width: 80px; height: 32px; font-size: 14px; background: #f9fafb; }
.rw-primary { width: 108px; height: 32px; font-size: 14px; }
.rw-tablewrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.rw-table { width: 100%; border-collapse: collapse; }
.rw-table th {
  height: 40px; padding: 0 8px; background: #f8fafc; font-size: 12px; font-weight: 500;
  color: #111827; text-align: left; white-space: nowrap;
}
.rw-table td { padding: 0 8px; font-size: 14px; color: #1e293b; }
.rw-empty { height: 112px; text-align: center; color: #6b7280; }
.rw-foot { display: flex; align-items: center; gap: 8px; padding: 18px 0 0; font-size: 14px; color: #6b7280; }
.rw-foot .spacer, .rw-toolbar .spacer { flex: 1; }
.pg { padding: 0 4px; font-size: 14px; }
.page-btn {
  height: 28px; padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 4.8px; background: #fff;
  color: #cbd5e1; font-size: 12.8px; font-family: inherit;
}
</style>
