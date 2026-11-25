<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, projectById } from '@/mock'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => Number(route.params.pid))
const project = computed(() => projectById(projectId.value))
const tab = ref<'overview' | 'nodes'>('overview')

const projectTasks = computed(() => db.tasks.filter((t) => t.projectId === projectId.value))

const stageGroups = computed(() => {
  const list = projectTasks.value
  if (!list.length) return [] as { label: string; count: number }[]
  const withQc = list.filter((t) => t.qcNode).length
  return [
    { label: '—', count: list.length - withQc },
    { label: '—', count: withQc }
  ]
})

const nodeRows = [
  { name: '20261117质检通过', annotator: '泽漆', type: '通过', tasks: 1, status: '已提交', createdAt: '2026年11月17日 19:48' },
  { name: '20261110质检通过', annotator: '泽漆', type: '通过', tasks: 1, status: '已提交', createdAt: '2026年11月10日 13:46' }
]

function fmtAudio(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m${s}s`
}

function back() {
  router.push('/vendor/projects')
}

function allocate() {
  router.push(`/vendor/projects/${projectId.value}/allocate`)
}

function detail() {
  router.push(`/vendor/project/${projectId.value}/long-audio-work-details`)
}
</script>

<template>
  <div v-if="project" class="detail-page">
    <div class="top-actions">
      <button class="back-btn" @click="back">
        <Icon name="chevronLeft" :size="14" color="#111827" />返回
      </button>
    </div>

    <div class="hero">
      <div class="hero-id">
        <span>项目 ID #{{ project.id }}</span>
        <span class="dot">·</span>
        <span class="status-pill">{{ project.status }}</span>
      </div>
      <h2 class="hero-title">{{ project.name }}</h2>
      <div class="hero-meta">
        <span class="meta-item"><Icon name="languages" :size="14" color="#6b7280" />{{ project.lang }}</span>
        <span class="dot">·</span>
        <span class="meta-item"><Icon name="tag" :size="14" color="#6b7280" /><span class="type-badge">{{ project.type }}</span></span>
      </div>

      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-label"><span class="stat-ico"><Icon name="target" :size="16" color="#3b82f6" /></span>目标时长</div>
          <div class="stat-value">{{ project.targetHours }} <span>h</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label"><span class="stat-ico"><Icon name="calendar" :size="16" color="#3b82f6" /></span>已分配时长</div>
          <div class="stat-value">{{ project.allocatedHours }} <span>h</span></div>
        </div>
        <div class="stat-box">
          <div class="stat-label"><span class="stat-ico"><Icon name="clock" :size="16" color="#3b82f6" /></span>剩余可分配</div>
          <div class="stat-value blue">{{ project.targetHours - project.allocatedHours }} <span>h</span></div>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-top">
          <span>分配进度</span>
          <span>{{ project.targetHours ? Math.round((project.allocatedHours / project.targetHours) * 100) : 0 }}%</span>
        </div>
        <div class="progress-track">
          <i :style="{ width: (project.targetHours ? Math.round((project.allocatedHours / project.targetHours) * 100) : 0) + '%' }"></i>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">任务总览</button>
      <button class="tab" :class="{ active: tab === 'nodes' }" @click="tab = 'nodes'">验收节点</button>
    </div>

    <template v-if="tab === 'overview'">
      <div class="card">
        <div class="card-head">
          <div>
            <h3>子组织分配列表</h3>
            <p>将本项目的时长拆分并转分配给子组织</p>
          </div>
          <button class="dark-btn" @click="allocate">
            <Icon name="swap" :size="16" color="#fff" />转分配
          </button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 22%">子组织名称</th>
              <th style="width: 20%">分配时长(H)</th>
              <th style="width: 24%">分配时间</th>
              <th style="width: 20%">状态</th>
              <th style="width: 14%">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!project.subOrgs.length">
              <td colspan="5" class="empty-cell">暂无分配记录，点击右上角"转分配"开始分配</td>
            </tr>
            <tr v-for="s in project.subOrgs" :key="s.name">
              <td>{{ s.name }}</td>
              <td>{{ s.hours }}</td>
              <td>{{ s.at }}</td>
              <td>{{ s.status }}</td>
              <td><button class="text-btn" @click="allocate">转分配</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card task-card">
        <div class="card-head row">
          <div class="head-title">
            <Icon name="clipboard" :size="16" color="#6b7280" />
            <h3>任务状态总览</h3>
          </div>
          <span class="head-count">共 {{ projectTasks.length }} 个任务</span>
        </div>
        <div class="group-row">
          <button v-for="(g, i) in stageGroups" :key="i" class="group-box">
            <span class="group-label">{{ g.label }}</span>
            <span class="group-value">{{ g.count }}</span>
          </button>
        </div>
        <div class="filter-row">
          <div class="status-select">
            <select>
              <option>全部状态</option>
            </select>
            <span>全部状态</span>
            <Icon name="caretUpDown" :size="16" color="#9ca3af" />
          </div>
          <span class="head-count">共 {{ projectTasks.length }} 条</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 9.7%">任务 ID</th>
              <th style="width: 8.6%">当前阶段</th>
              <th style="width: 8.8%">音频时长</th>
              <th style="width: 28.5%">音频</th>
              <th style="width: 7%">标注员</th>
              <th style="width: 8.4%">质检员</th>
              <th style="width: 18.5%">更新时间</th>
              <th style="width: 10.5%">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in projectTasks" :key="t.id">
              <td>{{ t.id }}</td>
              <td><span class="stage-badge">—</span></td>
              <td>{{ fmtAudio(t.duration) }}</td>
              <td>
                <audio class="audio-player" controls preload="none"></audio>
              </td>
              <td>{{ t.assignee || '—' }}</td>
              <td>{{ t.qcNode || '—' }}</td>
              <td>{{ t.updatedAt || '—' }}</td>
              <td><button class="text-btn" @click="detail">明细</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="card nodes-card">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 30%">节点名称</th>
              <th style="width: 18%">标注员</th>
              <th style="width: 12%">类型</th>
              <th style="width: 10%">任务数</th>
              <th style="width: 12%">状态</th>
              <th style="width: 18%">创建时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in nodeRows" :key="n.name">
              <td>{{ n.name }}</td>
              <td>{{ n.annotator }}</td>
              <td>
                <span class="ok-badge"><Icon name="checkCircle" :size="12" color="#059669" />{{ n.type }}</span>
              </td>
              <td>{{ n.tasks }}</td>
              <td><span class="submitted-badge">{{ n.status }}</span></td>
              <td>{{ n.createdAt }}</td>
            </tr>
          </tbody>
        </table>
        <div class="nodes-foot">
          <button class="btn sm">管理验收节点</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page { padding: 0; }
.top-actions { display: flex; margin-bottom: 24px; }
.back-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #f3f4f6;
  font-size: 14px; font-weight: 500; color: var(--ink-1); cursor: pointer; font-family: inherit;
}
.hero {
  background: linear-gradient(to bottom right, rgba(15, 41, 66, .1) 0%, #fff 50%, #fff 100%);
  border: 1px solid var(--line); border-radius: 8.4px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1);
}
.hero-id { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-3); }
.dot { color: var(--ink-3); }
.status-pill {
  display: inline-flex; align-items: center; height: 20px; padding: 2px 8px; border-radius: 32px;
  background: #3b82f6; color: #fff; font-size: 12px; font-weight: 500;
}
.hero-title { margin: 4px 0 0; font-size: 24px; font-weight: 600; color: var(--ink-1); line-height: 32px; }
.hero-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 14px; color: var(--ink-3); }
.meta-item { display: inline-flex; align-items: center; gap: 4px; }
.type-badge {
  display: inline-flex; align-items: center; height: 20px; padding: 2px 8px; border-radius: 32px;
  background: #f1f5f9; color: #1e293b; font-size: 12px; font-weight: 500;
}
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
.stat-box { background: rgba(255, 255, 255, .6); border: 1px solid var(--line); border-radius: 6px; padding: 16px; }
.stat-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-3); }
.stat-ico {
  width: 24px; height: 24px; display: inline-grid; place-items: center;
  border-radius: 4.8px; background: rgba(59, 130, 246, .1);
}
.stat-value { margin-top: 8px; font-size: 20px; font-weight: 600; color: var(--ink-1); line-height: 28px; }
.stat-value span { font-size: 14px; font-weight: 400; color: var(--ink-3); margin-left: 2px; }
.stat-value.blue { color: var(--primary); }
.progress-wrap { margin-top: 20px; }
.progress-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-3); }
.progress-track { height: 8px; margin-top: 6px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
.progress-track i { display: block; height: 100%; background: linear-gradient(to right, #0f2942, rgba(15, 41, 66, .7)); }
.tabs {
  display: inline-flex; align-items: center; gap: 2px; margin-top: 24px; padding: 4px;
  background: #f3f4f6; border-radius: 6px;
}
.tab {
  display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 6px 12px;
  border: none; border-radius: 4.8px; background: transparent; color: var(--ink-3);
  font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
}
.tab.active { background: #f9fafb; color: var(--ink-1); box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1); }
.card {
  margin-top: 24px; background: #fff; border: 1px solid var(--line); border-radius: 8.4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1); overflow: hidden;
}
.card-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.card-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink-1); }
.card-head p { margin: 2px 0 0; font-size: 12px; color: var(--ink-3); line-height: 16px; }
.card-head.row { min-height: 45px; }
.head-title { display: flex; align-items: center; gap: 8px; }
.head-count { font-size: 12px; color: var(--ink-3); }
.dark-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
  border: 1px solid transparent; border-radius: 4.8px;
  background: linear-gradient(to right, #0f2942 0%, rgba(15, 41, 66, .85) 100%);
  color: #fff; font-size: 12.8px; font-weight: 500; font-family: inherit; cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px -1px rgba(0, 0, 0, .1);
}
.table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.table th {
  height: 40px; padding: 0 8px; background: #f8fafc; text-align: left;
  font-size: 12px; font-weight: 500; color: var(--ink-3); white-space: nowrap;
}
.table td {
  height: 49px; padding: 8px; font-size: 14px; color: var(--ink-2);
  border-top: 1px solid #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.table tbody tr:first-child td { border-top: 1px solid #f1f5f9; }
.empty-cell { height: 117px; text-align: center; color: var(--ink-3); border-top: none !important; }
.stage-badge {
  display: inline-flex; align-items: center; height: 20px; padding: 2px 8px; border-radius: 32px;
  border: 1px solid var(--line); color: var(--ink-1); font-size: 12px; font-weight: 500;
}
.audio-player { width: 200px; height: 32px; vertical-align: middle; }
.text-btn {
  display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border: 1px solid transparent;
  background: transparent; border-radius: 4.8px; color: var(--ink-3); font-size: 12px; font-weight: 500;
  font-family: inherit; cursor: pointer;
}
.text-btn:hover { background: #f3f4f6; color: var(--ink-1); }
.group-row { display: flex; gap: 12px; padding: 20px; }
.group-box {
  width: 244px; height: 74px; display: flex; flex-direction: column; align-items: flex-start;
  padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: #fff;
  font-family: inherit; cursor: pointer;
}
.group-label { font-size: 12px; color: var(--ink-3); line-height: 16px; }
.group-value { margin-top: 6px; font-size: 18px; font-weight: 600; color: var(--ink-1); line-height: 28px; }
.filter-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
.status-select {
  position: relative; display: flex; align-items: center; gap: 8px; width: 180px; height: 32px;
  padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: #fff;
  font-size: 14px; color: var(--ink-1);
}
.status-select select { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.status-select span { flex: 1; }
.nodes-card .table td { height: 40px; }
.nodes-foot { display: flex; justify-content: flex-end; padding: 8px 16px; border-top: 1px solid #f1f5f9; }
.ok-badge {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px;
  background: rgba(16, 185, 129, .06); border: 1px solid rgba(16, 185, 129, .3); color: #059669;
  font-size: 12px; font-weight: 500;
}
.submitted-badge {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px;
  background: rgba(59, 130, 246, .1); color: #3b82f6; font-size: 12px; font-weight: 500;
}
</style>
