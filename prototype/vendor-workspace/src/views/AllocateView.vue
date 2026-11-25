<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectById } from '@/mock'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const pid = computed(() => Number(route.params.pid))
const project = computed(() => projectById(pid.value))

const keyword = ref('')
const suffix = ref('')
const hours = ref<number | string>(0)
const subOrgs = computed(() => project.value?.subOrgs || [])

const percent = computed(() => {
  if (!project.value?.targetHours) return 0
  return Math.round(((project.value.allocatedHours || 0) / project.value.targetHours) * 100)
})

function back() {
  router.push(`/vendor/projects/${pid.value}`)
}
</script>

<template>
  <div v-if="project" class="alloc-page">
    <div class="page-line">
      <button class="back-link" @click="back">
        <Icon name="chevronLeft" :size="14" color="#6b7280" />返回详情
      </button>
      <h1>转分配给子组织</h1>
    </div>

    <div class="hero">
      <div class="hero-id">项目 ID #{{ project.id }}</div>
      <h2 class="hero-title">{{ project.name }}</h2>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-label">目标时长</div>
          <div class="stat-value">{{ project.targetHours }} <span>h</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">已分配时长</div>
          <div class="stat-value">{{ project.allocatedHours }} <span>h</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label">剩余可分配</div>
          <div class="stat-value blue">{{ project.targetHours - project.allocatedHours }} <span>h</span></div>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-top"><span>分配进度</span><span>{{ percent }}%</span></div>
        <div class="progress-track"><i :style="{ width: percent + '%' }"></i></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>新建分配</h3>
        <p>选择子组织并填写分配时长</p>
      </div>
      <div class="alloc-grid">
        <div class="org-col">
          <div class="field-label">组织结构</div>
          <div class="search-box">
            <Icon name="search" :size="14" color="#9ca3af" />
            <input v-model="keyword" placeholder="搜索子组织名称" />
          </div>
          <div class="org-list">
            <span v-if="!subOrgs.length" class="org-empty">暂无子组织</span>
            <div v-for="o in subOrgs" :key="o.name" class="org-item">{{ o.name }}</div>
          </div>
        </div>
        <div class="fields">
          <div class="suffix-col">
            <div class="field-label">项目名称后缀</div>
            <input v-model="suffix" class="input" placeholder="输入后缀，将与上游项目名以下划线拼接" />
          </div>
          <div class="hours-col">
            <div class="field-label">分配时长 (小时)</div>
            <input v-model="hours" class="input" type="number" min="0" />
          </div>
          <button class="confirm-btn" :disabled="!subOrgs.length">确认分配</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head plain"><h3>已分配列表</h3></div>
      <table class="table">
        <thead>
          <tr>
            <th style="width: 20%">子组织名称</th>
            <th style="width: 22%">项目名称</th>
            <th style="width: 18%">分配时长(H)</th>
            <th style="width: 18%">状态</th>
            <th style="width: 22%">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!subOrgs.length">
            <td colspan="5">
              <div class="empty-state">
                <span class="empty-ico"><Icon name="mailOpen" :size="26" color="#3b82f6" /></span>
                <b>暂无分配记录</b>
                <p>当前项目还没有分配给子组织，请通过上方表单新建分配</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.alloc-page { padding: 0; }
.page-line { display: flex; align-items: center; gap: 12px; }
.back-link {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 6px;
  border: none; background: transparent; color: var(--ink-3); font-size: 14px;
  font-family: inherit; cursor: pointer; border-radius: 5px;
}
.back-link:hover { background: #f3f4f6; }
.page-line h1 { margin: 0; font-size: 20px; font-weight: 600; color: var(--ink-1); line-height: 28px; }
.hero {
  margin-top: 18px; background: linear-gradient(to bottom right, rgba(15, 41, 66, .1) 0%, #fff 50%, #fff 100%);
  border: 1px solid var(--line); border-radius: 8.4px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1);
}
.hero-id { font-size: 12px; color: var(--ink-3); line-height: 16px; }
.hero-title { margin: 4px 0 0; font-size: 24px; font-weight: 600; color: var(--ink-1); line-height: 32px; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
.stat-box { background: rgba(255, 255, 255, .6); border: 1px solid var(--line); border-radius: 6px; padding: 16px; }
.stat-label { font-size: 12px; color: var(--ink-3); }
.stat-value { margin-top: 8px; font-size: 20px; font-weight: 600; color: var(--ink-1); line-height: 28px; }
.stat-value span { font-size: 14px; font-weight: 400; color: var(--ink-3); margin-left: 2px; }
.stat-value.blue { color: var(--primary); }
.progress-wrap { margin-top: 20px; }
.progress-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-3); }
.progress-track { height: 6px; margin-top: 6px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
.progress-track i { display: block; height: 100%; background: linear-gradient(to right, #0f2942, rgba(15, 41, 66, .7)); }
.card {
  margin-top: 24px; background: #fff; border: 1px solid var(--line); border-radius: 8.4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1); overflow: hidden;
}
.card-head { display: block; padding: 12px 20px; }
.card-head.plain { min-height: 45px; }
.card-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink-1); }
.card-head p { margin: 2px 0 0; font-size: 12px; color: var(--ink-3); line-height: 16px; }
.alloc-grid { display: grid; grid-template-columns: 38% minmax(0, 1fr); gap: 24px; padding: 8px 20px 20px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--ink-1); margin-bottom: 6px; }
.search-box {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.search-box input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; }
.org-list {
  margin-top: 10px; height: 160px; border: 1px solid var(--line); border-radius: 6px;
  display: grid; place-items: center; background: #fff;
}
.org-empty { font-size: 12px; color: var(--ink-3); }
.fields { display: grid; grid-template-columns: minmax(0, 1fr) 179px auto; gap: 16px; align-items: start; }
.fields .input { width: 100%; }
.confirm-btn {
  margin-top: 26px; height: 28px; padding: 0 12px; border: none; border-radius: 4.8px;
  background: #9ca3af; color: #fff; font-size: 12.8px; font-weight: 500; font-family: inherit; cursor: not-allowed;
}
.table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.table th {
  height: 40px; padding: 0 8px; background: #f8fafc; text-align: left;
  font-size: 12px; font-weight: 500; color: var(--ink-3); white-space: nowrap;
}
.table td { padding: 0 8px; font-size: 14px; color: var(--ink-2); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 0 72px; }
.empty-ico {
  width: 56px; height: 56px; border-radius: 12px; background: #eff6ff;
  display: grid; place-items: center;
}
.empty-state b { margin-top: 12px; font-size: 16px; font-weight: 600; color: var(--ink-1); }
.empty-state p { margin: 6px 0 0; font-size: 14px; color: var(--ink-3); }
</style>
