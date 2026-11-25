<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '@/composables/toast'

const tab = ref<'link' | 'records'>('link')
const dept = ref('未指定')
const policy = ref('自动加入')
const expire = ref('3 天（默认）')
const maxUse = ref('')

function generate() {
  const link = `https://ding-tag.dingtalk.com/invite/${Math.random().toString(36).slice(2, 10)}`
  navigator.clipboard?.writeText(link).catch(() => undefined)
  toast('邀请链接已生成并复制（演示）', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>邀请成员</h1>
      <span class="sub">通过链接邀请新成员加入组织，并查看所有历史邀请记录</span>
    </div>

    <div class="seg toolbar-seg">
      <button :class="{ on: tab === 'link' }" @click="tab = 'link'">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 1 0-3.7l2-2a2.6 2.6 0 0 1 3.7 3.7l-1 1M9.4 6.6a2.6 2.6 0 0 1 0 3.7l-2 2a2.6 2.6 0 0 1-3.7-3.7l1-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
        链接邀请
      </button>
      <button :class="{ on: tab === 'records' }" @click="tab = 'records'">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
        邀请记录
      </button>
    </div>

    <div class="panel">
      <div v-if="tab === 'link'" class="panel-body">
        <h3 class="blk-title">链接邀请</h3>
        <p class="blk-desc">生成一条可多人使用的邀请链接</p>

        <div class="form-grid">
          <div class="field">
            <label>所属部门</label>
            <select v-model="dept" class="select">
              <option>未指定</option>
              <option>语音标注部</option>
              <option>质量管理部</option>
              <option>项目管理部</option>
              <option>数据运营部</option>
            </select>
          </div>
          <div class="field">
            <label>加入策略</label>
            <select v-model="policy" class="select">
              <option>自动加入</option>
              <option>需审批</option>
            </select>
          </div>
          <div class="field">
            <label>有效期</label>
            <select v-model="expire" class="select">
              <option>1 天</option>
              <option>3 天（默认）</option>
              <option>7 天</option>
              <option>30 天</option>
            </select>
          </div>
          <div class="field">
            <label>最大使用次数（可选）</label>
            <input v-model="maxUse" class="input" placeholder="不限" />
            <div class="hint">留空表示该链接不限制使用次数</div>
          </div>
        </div>

        <button class="btn primary" @click="generate">生成并复制邀请链接</button>
      </div>

      <div v-else>
        <table class="table">
          <thead><tr><th>邀请链接</th><th>所属部门</th><th>加入策略</th><th>有效期</th><th>使用次数</th><th>创建时间</th><th>操作</th></tr></thead>
        </table>
        <div class="empty">
          <p class="empty-title">暂无邀请记录</p>
          <p class="empty-sub">生成邀请链接后，使用记录会出现在这里。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-seg { margin-bottom: 14px; }
.panel-body { padding: 16px 20px 22px; }
.blk-title { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
.blk-desc { font-size: 12px; color: var(--ink-3); margin: 0 0 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; max-width: 720px; margin-bottom: 8px; }
.empty-title { font-size: 13px; color: var(--ink-2); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--ink-3); margin: 0; }
@media (max-width: 900px) { .form-grid { grid-template-columns: 1fr; } }
</style>
