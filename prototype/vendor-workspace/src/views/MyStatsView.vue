<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import StatTile from '@/components/stats/StatTile.vue'
import TrendChart from '@/components/stats/TrendChart.vue'
import FunnelRows from '@/components/stats/FunnelRows.vue'
import { db, projectById } from '@/mock'
import { toast } from '@/composables/toast'
import { downloadCsv } from '@/composables/download'

const route = useRoute()
const router = useRouter()

const project = computed(() => {
  const id = Number(route.params.pid || route.query.vendorProjectId || 0)
  return id ? projectById(id) : null
})

type Mode = 'realtime' | 'history' | 'new'
const mode = ref<Mode>(
  route.query.mode === 'history' ? 'history' : route.query.mode === 'quality' ? 'new' : 'realtime'
)
const tab = ref<'ann' | 'qc'>(route.query.view === 'qc' ? 'qc' : 'ann')
const preset = ref<'7' | '30'>(mode.value === 'realtime' ? '7' : '30')
const from = ref(mode.value === 'realtime' ? '2026-11-19' : '2026-10-27')
const to = ref('2026-11-25')
const newDate = ref('2026-11-17')
const includeHoliday = ref(true)

function switchMode(m: Mode) {
  mode.value = m
  preset.value = m === 'realtime' ? '7' : '30'
  from.value = m === 'realtime' ? '2026-11-19' : '2026-10-27'
  to.value = '2026-11-25'
  const query: Record<string, string> = { ...(route.query as Record<string, string>) }
  delete query.mode
  if (m === 'history') query.mode = 'history'
  if (m === 'new') query.mode = 'quality'
  router.replace({ query })
}
function pickRange(days: '7' | '30') {
  preset.value = days
  from.value = days === '7' ? '2026-11-19' : '2026-10-27'
  to.value = '2026-11-25'
}

/* ---------------- 每日实时 ---------------- */
const rtAnnFeatured = [
  { label: '任务总数', value: '0', icon: 'listTodo', tone: 'blue' as const },
  { label: '有效任务', value: '0', icon: 'checkCircle', tone: 'gray' as const, sub: '有效占比 0.0%' },
  { label: '有效时长', value: '0s', icon: 'timer', tone: 'gray' as const },
  { label: '标注耗时', value: '0s', icon: 'penTool', tone: 'gray' as const }
]
const rtAnnCompact = [{ label: '驳回次数', value: '0', icon: 'rotateCcw', tone: 'gray' as const }]
const rtQcFeatured = [
  { label: '质检任务数', value: '0', icon: 'listTodo', tone: 'blue' as const },
  { label: '任务时长', value: '0s', icon: 'clock', tone: 'gray' as const },
  { label: '质检耗时', value: '0s', icon: 'shield', tone: 'gray' as const }
]

/* ---------------- 历史统计 ---------------- */
const histAnnFeatured = [
  { label: '工作时长', value: '6m 38s', icon: 'clock', tone: 'blue' as const, spark: [140, 140, 140, 140, 140, 398] },
  { label: '任务数', value: '5', icon: 'list', tone: 'blue' as const, sub: '已提交 0' },
  { label: '已提交', value: '0', icon: 'send', tone: 'gray' as const },
  { label: '上传时长', value: '0s', icon: 'upload', tone: 'gray' as const }
]
const histAnnCompact = [
  { label: '有效时长', value: '0s', icon: 'checkCircle', tone: 'gray' as const },
  { label: '无效时长', value: '0s', icon: 'xCircle', tone: 'orange' as const },
  { label: '返工数', value: '0', icon: 'refresh', tone: 'gray' as const },
  { label: '上传数', value: '0', icon: 'upload', tone: 'gray' as const }
]
const histQcFeatured = [
  { label: '工作时长', value: '57m 17s', icon: 'clock', tone: 'blue' as const, spark: [90, 90, 90, 90, 90, 3437] },
  { label: '任务数', value: '7', icon: 'list', tone: 'blue' as const, sub: '已提交 0' },
  { label: '已提交', value: '0', icon: 'send', tone: 'gray' as const },
  { label: '上传时长', value: '0s', icon: 'upload', tone: 'gray' as const }
]

const histLabels = ['11/19', '11/20', '11/21', '11/22', '11/23', '11/24']
const histAnnDuration = [
  { name: '工作时长', color: '#2563eb', values: [140, 140, 140, 140, 140, 398] },
  { name: '有效时长', color: '#22d3ee', values: [0, 0, 0, 0, 0, 0] },
  { name: '无效时长', color: '#f59e0b', values: [0, 0, 0, 0, 0, 0] }
]
const histAnnTasks = [
  { name: '任务数', color: '#2563eb', values: [5, 5, 5, 5, 5, 5] },
  { name: '已提交任务', color: '#06b6d4', values: [0, 0, 0, 0, 0, 0] },
  { name: '返工', color: '#f59e0b', values: [0, 0, 0, 0, 0, 0] }
]
const histQcDuration = [
  { name: '工作时长', color: '#2563eb', values: [90, 90, 90, 90, 90, 3437] },
  { name: '有效时长', color: '#22d3ee', values: [0, 0, 0, 0, 0, 0] },
  { name: '无效时长', color: '#f59e0b', values: [0, 0, 0, 0, 0, 0] }
]
const histQcTasks = [
  { name: '任务数', color: '#2563eb', values: [7, 7, 7, 7, 7, 7] },
  { name: '已提交任务', color: '#06b6d4', values: [0, 0, 0, 0, 0, 0] },
  { name: '返工', color: '#f59e0b', values: [0, 0, 0, 0, 0, 0] }
]

/* ---------------- 历史统计(新) ---------------- */
const newAnnCards = [
  { label: '标注提交时长', value: '0s', sub: '共 0 条' },
  { label: '标注有效时长', value: '0s', sub: '0 条 · 占提交 —' },
  { label: '标注通过时长', value: '0s', sub: '0 条 · 占有效 —' },
  { label: '验收提交时长', value: '0s', sub: '共 0 条' },
  { label: '验收有效时长', value: '0s', sub: '0 条 · 占验收 —' }
]
const newQcCards = [
  { label: '质检提交时长', value: '1h 51m', sub: '共 19 条' },
  { label: '质检有效时长', value: '1h 51m', sub: '19 条 · 占提交 100%' },
  { label: '质检通过时长', value: '28m 1s', sub: '5 条 · 占有效 25%' },
  { label: '验收提交时长', value: '31m 5s', sub: '共 6 条' },
  { label: '验收有效时长', value: '31m 5s', sub: '6 条 · 占验收 100%' }
]

const funnelAnn = computed(() => ({
  base: { label: '标注提交时长', count: '0 条', dur: '0s', pct: '—' },
  groups: [
    {
      title: '标注环节',
      rows: [
        { label: '标注有效时长', count: '0 条', dur: '0s', pct: '—' },
        { label: '标注通过时长', count: '0 条', dur: '0s', pct: '—' }
      ]
    },
    {
      title: '质检环节',
      rows: [
        { label: '质检提交时长', count: '0 条', dur: '0s', pct: '—' },
        { label: '质检有效时长', count: '0 条', dur: '0s', pct: '—' },
        { label: '质检通过时长', count: '0 条', dur: '0s', pct: '—' }
      ]
    },
    {
      title: '验收环节',
      rows: [
        { label: '验收提交时长', count: '0 条', dur: '0s', pct: '—' },
        { label: '验收有效时长', count: '0 条', dur: '0s', pct: '—' }
      ]
    }
  ]
}))
const funnelQc = {
  base: { label: '质检提交时长', count: '19 条', dur: '1h 51m', pct: '100.0%' },
  groups: [
    {
      title: '标注环节',
      rows: [
        { label: '标注提交时长', count: '0 条', dur: '0s', pct: '0.0%', na: true },
        { label: '标注有效时长', count: '0 条', dur: '0s', pct: '0.0%', na: true },
        { label: '标注通过时长', count: '0 条', dur: '0s', pct: '0.0%', na: true }
      ]
    },
    {
      title: '质检环节',
      rows: [
        { label: '质检有效时长', count: '19 条', dur: '1h 51m', pct: '100.0%' },
        { label: '质检通过时长', count: '5 条', dur: '28m 1s', pct: '25.1%' }
      ]
    },
    {
      title: '验收环节',
      rows: [
        { label: '验收提交时长', count: '6 条', dur: '31m 5s', pct: '27.9%' },
        { label: '验收有效时长', count: '6 条', dur: '31m 5s', pct: '27.9%' }
      ]
    }
  ]
}

const newAnnMetrics = [
  { label: '标注提交时长', value: '0s', sub: '0' },
  { label: '标注有效时长', value: '0s', sub: '0' },
  { label: '标注通过时长', value: '0s', sub: '0' },
  { label: '驳回待返工', value: '0s', sub: '0' },
  { label: '人效', value: '—', sub: 'min/h' },
  { label: '标注 CER', value: '—', sub: '样本不足（0 字）' },
  { label: '标注句准率', value: '—', sub: '样本不足（0 句）' }
]
const newQcMetrics = [
  { label: '质检提交时长', value: '1h 51m', sub: '19' },
  { label: '质检有效时长', value: '1h 51m', sub: '19' },
  { label: '质检通过时长', value: '28m 1s', sub: '5' },
  { label: '质检驳回时长', value: '59m 22s', sub: '16' },
  { label: '人效', value: '9.1', sub: 'min/h' },
  { label: '质检 CER', value: '1.17%', sub: '基于 8,101 字 · 6 条任务（抽检）' },
  { label: '质检句准率', value: '—', sub: '样本不足（0 句）' }
]

const newLabels = ['11-18', '11-19', '11-20', '11-21', '11-22', '11-23', '11-24']
const newAnnTrend = [{ name: '标注提交时长', color: '#2563eb', values: [0, 0, 0, 0, 0, 0, 0] }]
const newQcTrend = [{ name: '质检提交时长', color: '#2563eb', values: [2287, 0, 0, 0, 0, 0, 0] }]

const projectRows = computed(() => {
  const names = db.projects.map((p) => p.name)
  if (tab.value === 'ann') {
    return names.map((n) => ({
      name: n,
      cells: [
        { v: '0s', c: '0' },
        { v: '0s', c: '0' },
        { v: '0s', c: '0' },
        { v: '0s', c: '0' }
      ],
      eff: '—',
      cer: '—',
      acc: '—'
    }))
  }
  const qc = [
    { v: '15m 51s', c: '7' },
    { v: '15m 51s', c: '7' },
    { v: '2m 33s', c: '2' },
    { v: '20m 53s', c: '11' },
    { eff: '6.3', cer: '1.83%', acc: '—' }
  ]
  const qc2 = [
    { v: '1h 23m', c: '11' },
    { v: '1h 23m', c: '11' },
    { v: '13m 17s', c: '2' },
    { v: '38m 29s', c: '5' },
    { eff: '9.3', cer: '1.06%', acc: '—' }
  ]
  const qc3 = [
    { v: '12m 11s', c: '1' },
    { v: '12m 11s', c: '1' },
    { v: '12m 11s', c: '1' },
    { v: '0s', c: '0' },
    { eff: '15.3', cer: '1.02%', acc: '—' }
  ]
  const qcRows = [qc, qc2, qc3]
  return names.map((n, i) => {
    const src = qcRows[i] || qcRows[0]
    return {
      name: n,
      cells: src.slice(0, 4) as { v: string; c: string }[],
      eff: (src[4] as { eff: string }).eff,
      cer: (src[4] as { cer: string }).cer,
      acc: (src[4] as { acc: string }).acc
    }
  })
})

const qcTotal = { cells: [
  { v: '1h 51m', c: '19' },
  { v: '1h 51m', c: '19' },
  { v: '28m 1s', c: '5' },
  { v: '59m 22s', c: '16' }
], eff: '9.1', cer: '1.17%', acc: '—' }

function exportDaily() {
  downloadCsv('我的统计-按日历史明细.csv', [
    ['日期', '任务数', '有效任务', '任务时长', '有效时长', '标注耗时'],
    [from.value, '0', '0', '0s', '0s', '0s']
  ])
  toast('已导出按日历史明细', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>我的统计</h1>
      <span class="sub">{{ project ? `当前项目：${project.name} · 仅展示该项目内的标注与质检数据` : '当前账号在全部项目中的标注与质检数据概览' }}</span>
      <div class="head-actions">
        <button class="audio-pill" @click="toast('数据模态：音频项目')">
          <span class="badge"><Icon name="sparkle" :size="12" /></span>
          音频项目
        </button>
      </div>
    </div>

    <div class="sp-body">
      <aside class="sp-rail">
        <div class="sp-rail-item" :class="{ on: mode === 'realtime' }" @click="switchMode('realtime')">
          <span class="dot"></span>每日实时
        </div>
        <div class="sp-rail-item" :class="{ on: mode === 'history' }" @click="switchMode('history')">
          <span class="dot"></span>历史统计
        </div>
        <div class="sp-rail-item" :class="{ on: mode === 'new' }" @click="switchMode('new')">
          <span class="dot"></span>历史统计(新)
        </div>
      </aside>

      <div class="sp-main">
        <!-- ============ 每日实时 ============ -->
        <template v-if="mode === 'realtime'">
          <div class="sp-tabs-line">
            <div class="sp-dark-tabs">
              <button :class="{ on: tab === 'ann' }" @click="tab = 'ann'">我的标注统计</button>
              <button :class="{ on: tab === 'qc' }" @click="tab = 'qc'">我的质检统计</button>
            </div>
          </div>

          <div class="sp-strip">
            <span class="live-tag">实时</span>
            <h2>每日实时统计</h2>
            <span class="desc">数据实时计算，包含统计区间内数据</span>
          </div>

          <template v-if="tab === 'ann'">
            <div class="sp-grid c4">
              <StatTile v-for="c in rtAnnFeatured" :key="c.label" v-bind="c" />
            </div>
            <div class="sp-grid c4">
              <StatTile v-for="c in rtAnnCompact" :key="c.label" v-bind="c" variant="compact" />
            </div>
          </template>
          <template v-else>
            <div class="sp-grid c4">
              <StatTile v-for="c in rtQcFeatured" :key="c.label" v-bind="c" />
            </div>
          </template>

          <section class="sp-panel">
            <div class="sp-panel-hd">
              <span class="live-tag">实时</span>
              <h2>按日历史明细</h2>
              <span class="desc">来自每日实时统计的按日历史记录</span>
              <div class="hd-tools">
                <button class="sp-btn" @click="exportDaily"><Icon name="download" :size="13" />导出</button>
                <button class="sp-btn" :class="{ on: preset === '7' }" @click="pickRange('7')">近7天</button>
                <button class="sp-btn" :class="{ on: preset === '30' }" @click="pickRange('30')">近30天</button>
                <span class="sp-date"><Icon name="calendar" :size="13" color="#8a919f" />{{ from }} ~ {{ to }}</span>
                <button class="sp-btn primary" @click="toast('查询完成', 'info')"><Icon name="search" :size="13" color="#fff" />查询</button>
              </div>
            </div>
            <div class="sp-empty">
              <div class="glyph"><Icon name="chartAxis" :size="28" color="#3b7ff5" /></div>
              <h3>暂无统计数据</h3>
              <p>当前日期范围内没有统计记录。</p>
            </div>
          </section>
        </template>

        <!-- ============ 历史统计 ============ -->
        <template v-else-if="mode === 'history'">
          <div class="sp-history-bar">
            <div class="sp-banner">
              <span class="ico"><Icon name="info" :size="14" /></span>
              <span>历史统计为每日全量累计快照（非当日新增数据），离线链路通常更新至前一日（T-1）；实际可用日期以页面数据为准</span>
            </div>
            <div class="sp-toolbar">
              <button class="sp-btn" @click="toast('已下载历史统计快照', 'ok')"><Icon name="download" :size="13" />下载</button>
              <button class="sp-btn" :class="{ on: preset === '7' }" @click="pickRange('7')">近7天</button>
              <button class="sp-btn" :class="{ on: preset === '30' }" @click="pickRange('30')">近30天</button>
              <span class="sp-date"><Icon name="calendar" :size="13" color="#8a919f" />{{ from }} ~ {{ to }}</span>
              <button class="sp-btn primary" @click="toast('查询完成', 'info')"><Icon name="search" :size="13" color="#fff" />查询</button>
            </div>
          </div>

          <div class="sp-seg" style="margin-bottom: 16px">
            <button :class="{ on: tab === 'ann' }" @click="tab = 'ann'">我的标注统计</button>
            <button :class="{ on: tab === 'qc' }" @click="tab = 'qc'">我的质检统计</button>
          </div>

          <div class="sp-strip">
            <span class="live-tag">历史统计</span>
            <h2>个人历史概览</h2>
            <span class="desc">{{ tab === 'ann' ? '标注任务累计快照（截至所选范围最后一日）' : '质检任务累计快照（截至所选范围最后一日）' }}</span>
          </div>

          <div class="sp-grid c4">
            <StatTile v-for="c in tab === 'ann' ? histAnnFeatured : histQcFeatured" :key="c.label" v-bind="c" />
          </div>
          <div class="sp-grid c4">
            <StatTile v-for="c in histAnnCompact" :key="c.label" v-bind="c" variant="compact" />
          </div>

          <section class="sp-panel">
            <div class="sp-chart-hd">
              <Icon name="bars" :size="16" color="#4e5969" />
              <h2>每日趋势（每日累计快照） — 工作时长</h2>
              <div class="legend">
                <span><i style="background: #2563eb"></i>工作时长</span>
                <span><i style="background: #22d3ee"></i>有效时长</span>
                <span><i style="background: #f59e0b"></i>无效时长</span>
              </div>
            </div>
            <TrendChart :labels="histLabels" :series="tab === 'ann' ? histAnnDuration : histQcDuration" :height="250" />
          </section>

          <section class="sp-panel">
            <div class="sp-chart-hd">
              <Icon name="bars" :size="16" color="#4e5969" />
              <h2>每日趋势（每日累计快照） — 任务数</h2>
              <div class="legend">
                <span><i style="background: #2563eb"></i>任务数</span>
                <span><i style="background: #06b6d4"></i>已提交任务</span>
                <span><i style="background: #f59e0b"></i>返工</span>
              </div>
            </div>
            <TrendChart :labels="histLabels" :series="tab === 'ann' ? histAnnTasks : histQcTasks" :height="250" />
          </section>
        </template>

        <!-- ============ 历史统计(新) ============ -->
        <template v-else>
          <div class="new-hd">
            <div class="new-title">
              <h2>历史统计(新)</h2>
              <span class="desc">质效口径 · 每日快照(T-1)</span>
            </div>
            <div class="new-actions">
              <span class="sp-date"><Icon name="clock" :size="13" color="#8a919f" />数据最新日 2026-11-24</span>
              <button class="sp-btn" @click="toast('口径字典（演示）', 'info')"><Icon name="book" :size="13" />口径字典</button>
              <button class="sp-btn" @click="toast('已导出 CSV', 'ok')"><Icon name="download" :size="13" />导出 CSV</button>
              <button class="sp-btn" @click="toast('已刷新', 'ok')"><Icon name="refresh" :size="13" />刷新</button>
            </div>
          </div>

          <div class="sp-dark-tabs" style="margin-bottom: 16px">
            <button :class="{ on: tab === 'ann' }" @click="tab = 'ann'">标注视角</button>
            <button :class="{ on: tab === 'qc' }" @click="tab = 'qc'">质检视角</button>
          </div>

          <div class="new-filters">
            <button class="sp-btn proj-btn" @click="toast('项目范围：全部 3 个项目', 'info')">
              <Icon name="tree" :size="13" />全部 3 个项目
              <Icon name="chevronDown" :size="12" />
            </button>
            <div class="sp-dark-tabs scope-tabs">
              <button class="on">总量变动</button>
              <button @click="toast('范围内变动（演示）', 'info')">范围内变动</button>
            </div>
            <input v-model="newDate" class="sp-date-input" style="width: 130px" />
            <span class="new-hint">只能选截止日，统计数据起点到该日的累计</span>
          </div>

          <div class="policy-grid">
            <div v-for="c in tab === 'ann' ? newAnnCards : newQcCards" :key="c.label" class="policy-card">
              <div class="lbl">{{ c.label }}<span class="sp-tip"><Icon name="help" :size="13" /></span></div>
              <div class="val">{{ c.value }}</div>
              <div class="sub">{{ c.sub }}</div>
            </div>
          </div>
          <p class="upload-note">上传为录音粒度，与个人无映射，本页不展示总上传 / 有效上传时长</p>

          <section class="sp-panel">
            <div class="sp-panel-hd">
              <h2>数据流转漏斗</h2>
            </div>
            <p class="funnel-desc">{{ tab === 'ann' ? '基准 = 我的标注提交时长（100%）；层级固定展示，未发生的环节计为 0' : '基准 = 我的质检提交时长（100%）；层级固定展示，未发生的环节计为 0' }}</p>
            <div class="sp-seg" style="margin-bottom: 12px">
              <button class="on">整体</button>
              <button @click="toast('按项目（演示）', 'info')">按项目</button>
            </div>
            <FunnelRows v-if="tab === 'ann'" :base="funnelAnn.base" :groups="funnelAnn.groups" />
            <FunnelRows v-else :base="funnelQc.base" :groups="funnelQc.groups" />
          </section>

          <div class="new-notes">
            <p>按「经手日」归属，任务最终态记在首次经手当天，不是各环节动作日；横轴只覆盖所选区间（总量模式下固定为截止日前若干天），因此逐日求和只对区间内成立，不能与累计列相加对账。</p>
            <p>趋势按「经手日」归属：我经手的任务，其后续质检 / 验收结果仍记在经手当天</p>
            <p class="amber">2026 年的节假日未维护，工作日/休息日判定可能不准 <span class="sp-tip"><Icon name="help" :size="13" /></span></p>
          </div>

          <div class="sp-strip section-hd">
            <Icon name="checkCircle" :size="15" color="#4e5969" />
            <h2>{{ tab === 'ann' ? '标注' : '质检' }}</h2>
            <span v-if="tab === 'qc'" class="live-tag">抽检</span>
            <span class="desc">本视角的作业量、有效量、驳回与 CER；验收结果见漏斗</span>
          </div>

          <section class="sp-panel">
            <div class="sp-panel-hd">
              <h2>我的{{ tab === 'ann' ? '标注' : '质检' }}指标</h2>
              <span class="spacer"></span>
              <span class="meta-txt">{{ tab === 'ann' ? '我在 0 个项目有标注记录' : '我在 3 个项目有质检记录' }}</span>
            </div>
            <div class="sp-tiles metric-tiles">
              <StatTile
                v-for="m in tab === 'ann' ? newAnnMetrics : newQcMetrics"
                :key="m.label"
                :label="m.label"
                :value="m.value"
                :sub="m.sub"
                variant="tile"
                tip
              />
            </div>
          </section>

          <section class="sp-panel">
            <div class="sp-panel-hd">
              <h2>趋势</h2>
            </div>
            <p class="trend-desc">
              趋势按「经手日」归属：我经手的任务，其后续质检 / 验收结果仍记在经手当天 · 横轴 2026-11-18 ~ 2026-11-24
            </p>
            <div class="trend-tools">
              <button class="sp-btn">
                指标 · {{ tab === 'ann' ? '标注提交时长' : '质检提交时长' }}
                <Icon name="chevronDown" :size="12" />
              </button>
              <span class="sp-tip"><Icon name="help" :size="13" /></span>
              <label class="switch">
                <input v-model="includeHoliday" type="checkbox" />
                <span class="track"></span>
                <span>包含节假日</span>
              </label>
            </div>
            <p class="trend-sub">
              {{ tab === 'ann'
                ? '展示全部 7 个自然日，标注提交时长日均 0s，峰值 0s（2026-11-18）'
                : '展示全部 7 个自然日，质检提交时长日均 5m 27s，峰值 38m 7s（2026-11-18）' }}
            </p>
            <TrendChart
              :labels="newLabels"
              :series="tab === 'ann' ? newAnnTrend : newQcTrend"
              ymode="duration"
              :height="260"
              :shade="[3, 4]"
              tooltip-note="逐日量按各环节动作日分布，跨日转移属正常"
            />
            <div class="new-notes" style="margin-top: 12px">
              <p>按「经手日」归属，任务最终态记在首次经手当天，不是各环节动作日；横轴只覆盖所选区间（总量模式下固定为截止日前若干天），因此逐日求和只对区间内成立，不能与累计列相加对账。</p>
              <p>趋势按「经手日」归属：我经手的任务，其后续质检 / 验收结果仍记在经手当天</p>
              <p class="amber">2026 年的节假日未维护，工作日/休息日判定可能不准 <span class="sp-tip"><Icon name="help" :size="13" /></span></p>
            </div>
          </section>

          <section class="sp-panel">
            <div class="sp-panel-hd">
              <h2>⑤我的分项目明细</h2>
              <span class="spacer"></span>
              <span class="meta-txt">共 3 个项目 · 当前展示第 1–3 个 · 每页 20 个</span>
            </div>
            <div class="detail-scroll">
              <table class="sp-table detail-table">
                <thead>
                  <tr>
                    <th style="min-width: 300px">项目</th>
                    <th class="right">{{ tab === 'ann' ? '标注提交时长' : '质检提交时长' }}</th>
                    <th class="right">{{ tab === 'ann' ? '标注有效时长' : '质检有效时长' }}</th>
                    <th class="right">{{ tab === 'ann' ? '标注通过时长' : '质检通过时长' }}</th>
                    <th class="right">{{ tab === 'ann' ? '驳回待返工' : '质检驳回时长' }}</th>
                    <th class="right">人效</th>
                    <th class="right">{{ tab === 'ann' ? '标注 CER' : '质检 CER' }}</th>
                    <th class="right">{{ tab === 'ann' ? '标注句准率' : '质检句准率' }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in projectRows" :key="r.name">
                    <td>
                      <span class="proj-link">{{ r.name }} <Icon name="arrowUpRight" :size="11" /></span>
                    </td>
                    <td v-for="(c, i) in r.cells" :key="i" class="right">
                      <div class="cell-v">{{ c.v }}</div>
                      <div class="cell-c">{{ c.c }}</div>
                    </td>
                    <td class="right">{{ r.eff }}</td>
                    <td class="right">{{ r.cer }}</td>
                    <td class="right">{{ r.acc }}</td>
                  </tr>
                  <tr class="total-row">
                    <td>总计</td>
                    <td v-for="(c, i) in (tab === 'ann' ? [{ v: '0s', c: '0' }, { v: '0s', c: '0' }, { v: '0s', c: '0' }, { v: '0s', c: '0' }] : qcTotal.cells)" :key="'t' + i" class="right">
                      <div class="cell-v">{{ c.v }}</div>
                      <div class="cell-c">{{ c.c }}</div>
                    </td>
                    <td class="right">{{ tab === 'ann' ? '—' : qcTotal.eff }}</td>
                    <td class="right">{{ tab === 'ann' ? '—' : qcTotal.cer }}</td>
                    <td class="right">{{ tab === 'ann' ? '—' : qcTotal.acc }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sp-rail { padding-top: 16px; }
.sp-rail-item .dot { display: none; }
.sp-tabs-line { margin-top: 8px; margin-bottom: 16px; }
.sp-strip { margin-bottom: 20px; }

.new-hd { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.new-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.new-title h2 { font-size: 17px; font-weight: 600; margin: 0; }
.new-title .desc { font-size: 12px; color: #8a919f; }
.new-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.new-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.proj-btn { min-width: 190px; justify-content: space-between; }
.scope-tabs button { height: 30px; }
.new-hint { font-size: 12px; color: #8a919f; }

.policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (min-width: 1024px) { .policy-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.policy-card {
  background: #fff; border: 1px solid #e9ebef; border-radius: 12px; padding: 16px 18px; min-height: 96px;
}
.policy-card .lbl { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #4e5969; }
.policy-card .val { font-size: 22px; font-weight: 600; font-family: var(--mono); margin-top: 8px; }
.policy-card .sub { font-size: 11px; color: #9aa1ac; margin-top: 5px; }
.upload-note { font-size: 11px; color: #9aa1ac; margin: 10px 0 16px; }

.funnel-desc { font-size: 12px; color: #8a919f; margin: 6px 0 14px; }
.new-notes { margin: 2px 0 16px; }
.new-notes p { font-size: 12px; color: #8a919f; line-height: 1.7; margin: 3px 0; }
.new-notes p.amber { color: #d97706; display: flex; align-items: center; gap: 4px; }

.section-hd { margin-top: 10px; }
.section-hd h2 { font-size: 15px; }
.meta-txt { font-size: 12px; color: #8a919f; }
.metric-tiles { margin-top: 14px; }

.trend-desc { font-size: 12px; color: #8a919f; margin: 6px 0 12px; line-height: 1.6; }
.trend-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.trend-sub { font-size: 12px; color: #4e5969; margin: 12px 0 6px; }

.switch { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #4e5969; cursor: pointer; }
.switch input { display: none; }
.switch .track {
  width: 34px; height: 19px; border-radius: 999px; background: #d9dce2; position: relative; transition: background .15s;
}
.switch .track::after {
  content: ''; position: absolute; width: 15px; height: 15px; border-radius: 50%; background: #fff;
  top: 2px; left: 2px; transition: transform .15s; box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
}
.switch input:checked + .track { background: #1677ff; }
.switch input:checked + .track::after { transform: translateX(15px); }

.detail-scroll { overflow-x: auto; margin-top: 12px; }
.detail-table { min-width: 900px; }
.detail-table th { background: #f7f8fa; }
.detail-table .cell-v { font-size: 12px; font-family: var(--mono); }
.detail-table .cell-c { font-size: 11px; color: #9aa1ac; }
.proj-link { display: inline-flex; align-items: center; gap: 4px; color: #1f2329; cursor: pointer; }
.proj-link:hover { color: #1677ff; }
.total-row td { background: #fafbfc; font-weight: 600; }
</style>
