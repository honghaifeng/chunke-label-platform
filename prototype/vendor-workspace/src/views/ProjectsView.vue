<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/mock'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const router = useRouter()
const keyword = ref('')
const lang = ref('全部语种')
const type = ref('全部项目类型')

const rows = computed(() =>
  db.projects.filter((p) => {
    const okWord = !keyword.value || p.name.includes(keyword.value)
    const okLang = lang.value === '全部语种' || p.lang === lang.value
    const okType = type.value === '全部项目类型' || p.type === type.value
    return okWord && okLang && okType
  })
)

const doingCount = computed(() => rows.value.filter((p) => p.status === '进行中').length)
const doneCount = computed(() => rows.value.filter((p) => p.status === '已结束').length)
const totalPlan = computed(() => rows.value.reduce((s, p) => s + (p.planHours || 0), 0))

const stats = computed(() => [
  { label: '本页项目', value: rows.value.length, unit: '', icon: 'cube', bg: '#eff6ff', color: '#3b82f6' },
  { label: '进行中', value: doingCount.value, unit: '', icon: 'clock', bg: '#eff6ff', color: '#3b82f6' },
  { label: '已完成', value: doneCount.value, unit: '', icon: 'checkCircle', bg: '#ecfdf5', color: '#10b981' },
  { label: '本页总目标时长', value: totalPlan.value, unit: 'h', icon: 'hourglass', bg: '#fffbeb', color: '#f59e0b' }
])

function refresh() {
  toast('进度已刷新')
}

function detail(id: number) {
  router.push(`/vendor/project/${id}`)
}

function workbench(id: number) {
  router.push(`/vendor/project/${id}/long-audio`)
}

function config(id: number) {
  router.push(`/vendor/project/${id}/project-config`)
}

function percent(p: { planHours?: number; planAssigned?: number }) {
  if (!p.planHours) return 0
  return Math.min(100, Math.round(((p.planAssigned || 0) / p.planHours) * 100))
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>项目列表</h1>
      <span class="sub">我承接的项目与进度，共 {{ db.projects.length }} 个项目</span>
    </div>

    <div class="stat-row">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-main">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}<span v-if="s.unit">{{ s.unit }}</span></div>
        </div>
        <div class="stat-ico" :style="{ background: s.bg }">
          <Icon :name="s.icon" :size="16" :color="s.color" />
        </div>
      </div>
    </div>

    <div class="card list-card">
      <div class="list-head">
        <b>项目列表</b>
        <div class="head-right">
          <span class="muted" style="font-size: 12px">1 / 1</span>
          <button class="btn sm" @click="refresh"><Icon name="refresh" :size="12" />刷新进度</button>
        </div>
      </div>

      <div class="filters">
        <div class="search-box">
          <Icon name="search" :size="13" color="#8a919f" />
          <input v-model="keyword" placeholder="搜索子项目名称" />
        </div>
        <div class="filter-item">
          <span class="fl">语种</span>
          <div class="sel-box">
            <select v-model="lang">
              <option>全部语种</option>
              <option>普通话</option>
              <option>西南官话</option>
            </select>
            <Icon name="caretUpDown" :size="14" color="#9ca3af" />
          </div>
        </div>
        <div class="filter-item">
          <span class="fl">项目类型</span>
          <div class="sel-box">
            <select v-model="type">
              <option>全部项目类型</option>
              <option>长音频拉框</option>
            </select>
            <Icon name="caretUpDown" :size="14" color="#9ca3af" />
          </div>
        </div>
      </div>

      <div class="hint">进度按录音阶段已结束的台本统计；录音中的台本单独显示为在途，预计值按字数估算，仅供参考。</div>

      <table class="plist">
        <thead>
          <tr>
            <th style="width: 26%">子项目名称</th>
            <th style="width: 8%">语种</th>
            <th style="width: 11%">项目类型</th>
            <th style="width: 8%">状态</th>
            <th style="width: 16%">进度</th>
            <th style="width: 31%">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id">
            <td class="name-cell"><a class="name-link" :title="p.name" @click="detail(p.id)">{{ p.name }}</a></td>
            <td>{{ p.lang }}</td>
            <td>{{ p.type }}</td>
            <td>
              <span class="st-doing" v-if="p.status === '进行中'">进行中</span>
              <span class="st-done" v-else>{{ p.status }}</span>
            </td>
            <td>
              <div class="prog">
                <div class="prog-label">分配进度</div>
                <div class="prog-track"><i :style="{ width: percent(p) + '%' }"></i></div>
                <div class="prog-num">{{ p.planAssigned || 0 }}/{{ p.planHours || 0 }}h</div>
              </div>
            </td>
            <td class="ops">
              <button class="btn sm" @click="config(p.id)"><Icon name="config" :size="12" />配置</button>
              <button class="btn sm" @click="detail(p.id)"><Icon name="eye" :size="12" />查看详情</button>
              <button class="btn sm primary" @click="workbench(p.id)"><Icon name="enter" :size="12" color="#fff" />进入工作台</button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="empty">暂无符合条件的项目</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 14px; height: 78px;
}
.stat-label { font-size: 12px; font-weight: 500; color: var(--ink-3); }
.stat-value { font-size: 24px; font-weight: 600; line-height: 24px; margin-top: 8px; }
.stat-value span { font-size: 12px; color: var(--ink-3); font-weight: 400; margin-left: 3px; }
.stat-ico { width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; }

.list-card { padding: 0; }
.list-head { height: 53px; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--line); }
.list-head b { font-size: 14px; font-weight: 600; }
.head-right { display: flex; align-items: center; gap: 10px; }
.head-right > span { font-size: 12px; }
.head-right .btn { height: 28px; padding: 0 10px; gap: 5px; font-size: 12.8px; }

.filters { display: flex; align-items: center; gap: 16px; padding: 12px 20px 6px; }
.search-box {
  display: flex; align-items: center; gap: 8px; height: 32px; width: 288px; padding: 0 10px;
  border: 1px solid var(--line-strong); border-radius: 6px; background: #fff;
}
.search-box input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; }
.search-box input::placeholder { color: var(--ink-4); }
.filter-item { display: flex; align-items: center; gap: 8px; }
.filter-item .fl { font-size: 14px; color: var(--ink-3); white-space: nowrap; }
.sel-box {
  position: relative; display: flex; align-items: center; height: 32px; padding: 0 26px 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff; width: 156px;
}
.sel-box select {
  flex: 1; border: none; outline: none; background: transparent; font-size: 14px; font-family: inherit;
  color: var(--ink-1); appearance: none; cursor: pointer; min-width: 0;
}
.sel-box > svg { position: absolute; right: 8px; pointer-events: none; }

.hint { padding: 4px 20px 10px; font-size: 12px; color: var(--ink-3); }

.plist { width: 100%; border-collapse: collapse; border-top: 1px solid var(--line); table-layout: fixed; }
.plist th {
  height: 40px; background: #f8fafc; text-align: left; font-weight: 500; font-size: 12px;
  color: var(--ink-3); padding: 0 8px; white-space: nowrap;
}
.plist th:first-child, .plist td:first-child { padding-left: 16px; }
.plist td { height: 57px; padding: 8px; font-size: 14px; color: var(--ink-2); border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.plist tbody tr:last-child td { border-bottom: none; }
.plist tbody tr:hover { background: #fafbfc; }
.name-cell { overflow: hidden; text-overflow: ellipsis; }
.name-link { color: var(--primary); font-weight: 500; cursor: pointer; }
.name-link:hover { text-decoration: underline; }
.st-doing {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px;
  background: var(--primary); color: #fff; font-size: 12px; font-weight: 500;
}
.st-done { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; background: #f3f4f6; color: var(--ink-2); font-size: 12px; font-weight: 500; }
.prog { width: 100%; }
.prog-label { font-size: 12px; color: var(--ink-3); }
.prog-track { height: 6px; border-radius: 999px; background: #f3f4f6; margin: 4px 0; overflow: hidden; }
.prog-track i { display: block; height: 100%; background: var(--primary); border-radius: 999px; }
.prog-num { font-size: 12px; color: var(--ink-3); }
.ops { white-space: nowrap; }
.ops .btn { margin-right: 8px; height: 28px; padding: 0 10px; gap: 5px; font-size: 12.8px; }
.ops .btn:last-child { margin-right: 0; }
.empty { text-align: center; color: var(--ink-3); height: 120px; }
</style>
