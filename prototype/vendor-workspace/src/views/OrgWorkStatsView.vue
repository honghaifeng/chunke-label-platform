<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import StatTile from '@/components/stats/StatTile.vue'
import TrendChart from '@/components/stats/TrendChart.vue'
import { toast } from '@/composables/toast'
import { downloadCsv } from '@/composables/download'

const route = useRoute()
const mode = ref<'realtime' | 'history'>(route.query.mode === 'history' ? 'history' : 'realtime')
const rank = ref<'annotator' | 'reviewer'>('annotator')
const rankSort = ref<'time' | 'task'>('time')
const keyword = ref('')
const preset = ref<'7' | '30'>(mode.value === 'history' ? '30' : '7')
const from = ref('2026-11-19')
const to = ref('2026-11-25')

function pickRange(days: '7' | '30') {
  preset.value = days
  from.value = days === '7' ? '2026-11-19' : '2026-10-27'
  to.value = '2026-11-25'
}
function switchMode(m: 'realtime' | 'history') {
  mode.value = m
  pickRange(m === 'realtime' ? '7' : '30')
}

const dailyRows = [
  { date: '2026-11-19', member: '泽漆', tasks: 2, valid: 2, skipped: 0, taskTime: '5m 24s', validTime: '5m 24s', invalidTime: '0s', workTime: '41m 39s' }
]

const featured = [
  { label: '总时长', value: '4h 8m 46s', icon: 'clock', tone: 'blue' as const, spark: [1600, 1600, 1600, 1600, 1600, 1620] },
  { label: '总任务数', value: '63', icon: 'list', tone: 'blue' as const, sub: '已上传 63 批 · 已提交 24' },
  { label: '已提交任务', value: '24', icon: 'send', tone: 'blue' as const, sub: '占总任务 38.1%' },
  { label: '完成率', value: '38.1%', icon: 'percent', tone: 'orange' as const }
]
const compact = [
  { label: '已提交时长', value: '1h 37m 21s', icon: 'clock', tone: 'gray' as const },
  { label: '已上传时长', value: '4h 8m 46s', icon: 'clock', tone: 'gray' as const },
  { label: '质检通过数', value: '16', icon: 'shield', tone: 'gray' as const },
  { label: '返工数', value: '0', icon: 'refresh', tone: 'gray' as const },
  { label: '上传数', value: '63', icon: 'upload', tone: 'orange' as const },
  { label: '质检通过率', value: '100.0%', icon: 'percent', tone: 'gray' as const },
  { label: '返工率', value: '0.0%', icon: 'percent', tone: 'gray' as const },
  { label: '活跃标注员', value: '12', icon: 'users', tone: 'green' as const }
]

const labels = ['11/19', '11/20', '11/21', '11/22', '11/23', '11/24']
const durationSeries = [{ name: '总时长', color: '#2563eb', values: [14902, 14902, 14902, 14902, 14902, 14926] }]
const taskSeries = [
  { name: '总任务数', color: '#2563eb', values: [63, 63, 63, 63, 63, 63] },
  { name: '已提交任务', color: '#06b6d4', values: [24, 24, 24, 24, 24, 24] },
  { name: '质检通过', color: '#f59e0b', values: [16, 16, 16, 16, 16, 16] },
  { name: '返工', color: '#ec4899', values: [0, 0, 0, 0, 0, 0] }
]

const rankRows = [
  { rank: 1, name: 'denice', time: '1h 20m 29s', validTime: '0s', invalidTime: '0s', tasks: 18, submitted: 0, rework: 0 },
  { rank: 2, name: '泽漆', time: '58m 2s', validTime: '0s', invalidTime: '0s', tasks: 15, submitted: 6, rework: 0 },
  { rank: 3, name: '柠檬', time: '34m 30s', validTime: '0s', invalidTime: '0s', tasks: 7, submitted: 7, rework: 0 },
  { rank: 4, name: '唐舞麟', time: '32m 8s', validTime: '0s', invalidTime: '0s', tasks: 8, submitted: 5, rework: 0 },
  { rank: 5, name: '胡军', time: '29m 48s', validTime: '0s', invalidTime: '0s', tasks: 7, submitted: 6, rework: 0 },
  { rank: 6, name: '杭州春客', time: '6m 38s', validTime: '0s', invalidTime: '0s', tasks: 5, submitted: 0, rework: 0 }
]

function search() {
  toast(keyword.value ? `未找到「${keyword.value}」相关成员` : '请输入成员姓名')
}
function exportDaily() {
  downloadCsv('团队工作统计-按日历史明细.csv', [
    ['日期', '成员', '任务数', '有效任务', '跳过数', '任务时长', '有效时长', '无效时长', '工作耗时'],
    [dailyRows[0].date, dailyRows[0].member, dailyRows[0].tasks, dailyRows[0].valid, dailyRows[0].skipped, dailyRows[0].taskTime, dailyRows[0].validTime, dailyRows[0].invalidTime, dailyRows[0].workTime]
  ])
  toast('已导出按日历史明细', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>团队工作统计</h1>
      <span class="sub">查看组织成员的工作数据概览</span>
      <div class="head-actions">
        <button class="audio-pill" @click="toast('数据模态：音频项目')">
          <span class="badge"><Icon name="wave" :size="12" /></span>
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
      </aside>

      <div class="sp-main">
        <!-- ==================== 每日实时 ==================== -->
        <template v-if="mode === 'realtime'">
          <div class="rank-bar">
            <div class="big-tabs">
              <button :class="{ on: rank === 'annotator' }" @click="rank = 'annotator'">标注员排行榜</button>
              <button :class="{ on: rank === 'reviewer' }" @click="rank = 'reviewer'">质检员排行榜</button>
            </div>
            <div class="rank-search">
              <input v-model="keyword" placeholder="搜索人员..." @keyup.enter="search" />
              <button class="sp-btn" @click="search"><Icon name="search" :size="13" />搜索</button>
            </div>
          </div>

          <section class="sp-plain">
            <div class="sp-empty big">
              <div class="glyph"><Icon name="users" :size="30" color="#3b7ff5" /></div>
              <h3>暂无排行数据</h3>
              <p>当前筛选条件下没有成员数据。</p>
            </div>
          </section>

          <section class="sp-plain">
            <div class="sp-panel-hd">
              <span class="live-tag">实时</span>
              <h2>按日历史明细</h2>
              <span class="desc">来自每日实时统计的按日历史记录</span>
              <span class="spacer"></span>
              <div class="sp-toolbar">
                <button class="sp-btn" @click="exportDaily"><Icon name="download" :size="13" />导出</button>
                <button class="sp-btn" :class="{ on: preset === '7' }" @click="pickRange('7')">近7天</button>
                <button class="sp-btn" :class="{ on: preset === '30' }" @click="pickRange('30')">近30天</button>
                <span class="sp-date"><Icon name="calendar" :size="13" color="#8a919f" />{{ from }} ~ {{ to }}</span>
                <button class="sp-btn primary" @click="toast('查询完成：共 1 条记录', 'info')"><Icon name="search" :size="13" color="#fff" />查询</button>
              </div>
            </div>
            <div class="table-wrap">
              <table class="sp-table">
                <thead>
                  <tr>
                    <th>日期</th><th>成员</th><th>任务数</th><th>有效任务</th>
                    <th>跳过数</th><th>任务时长</th><th>有效时长</th>
                    <th>无效时长</th><th>工作耗时</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in dailyRows" :key="r.date + r.member">
                    <td>{{ r.date }}</td><td>{{ r.member }}</td>
                    <td>{{ r.tasks }}</td><td>{{ r.valid }}</td>
                    <td>{{ r.skipped }}</td>
                    <td class="mono">{{ r.taskTime }}</td><td class="mono">{{ r.validTime }}</td>
                    <td class="mono">{{ r.invalidTime }}</td><td class="mono">{{ r.workTime }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="sp-foot">
                <span>共 1 条记录</span>
                <div class="sp-pager">
                  <button disabled>上一页</button><span>1 / 1</span><button disabled>下一页</button>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ==================== 历史统计 ==================== -->
        <template v-else>
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

          <div class="sp-strip">
            <span class="live-tag">历史统计</span>
            <h2>团队历史概览</h2>
            <span class="desc">截至所选日期范围最后一日的全量累计快照</span>
          </div>

          <div class="sp-grid c4">
            <StatTile v-for="c in featured" :key="c.label" v-bind="c" />
          </div>
          <div class="sp-grid c4">
            <StatTile v-for="c in compact" :key="c.label" v-bind="c" variant="compact" />
          </div>

          <section class="sp-panel">
            <div class="sp-chart-hd">
              <Icon name="bars" :size="16" color="#4e5969" />
              <h2>每日趋势（每日累计快照） — 总时长</h2>
              <div class="legend"><span><i style="background: #2563eb"></i>总时长</span></div>
            </div>
            <TrendChart :labels="labels" :series="durationSeries" :height="240" />
          </section>

          <section class="sp-panel">
            <div class="sp-chart-hd">
              <Icon name="bars" :size="16" color="#4e5969" />
              <h2>每日趋势（每日累计快照） — 总任务数</h2>
              <div class="legend">
                <span><i style="background: #2563eb"></i>总任务数</span>
                <span><i style="background: #06b6d4"></i>已提交任务</span>
                <span><i style="background: #f59e0b"></i>质检通过</span>
                <span><i style="background: #ec4899"></i>返工</span>
              </div>
            </div>
            <TrendChart :labels="labels" :series="taskSeries" :height="240" />
          </section>

          <section class="sp-panel">
            <div class="sp-panel-hd rank-hd">
              <div class="sp-seg">
                <button :class="{ on: rank === 'annotator' }" @click="rank = 'annotator'">标注员排行</button>
                <button :class="{ on: rank === 'reviewer' }" @click="rank = 'reviewer'">质检员排行</button>
              </div>
              <span class="spacer"></span>
              <div class="sort-tabs">
                <button class="sort-pill" :class="{ on: rankSort === 'time' }" @click="rankSort = 'time'">按时长</button>
                <button class="sort-text" :class="{ on: rankSort === 'task' }" @click="rankSort = 'task'">按任务数排行</button>
              </div>
            </div>
            <table class="sp-table rank-table">
              <thead>
                <tr>
                  <th style="width: 60px">#</th><th>姓名</th>
                  <th class="right" style="width: 110px">时长</th>
                  <th class="right" style="width: 90px">有效时长</th>
                  <th class="right" style="width: 90px">无效时长</th>
                  <th class="right" style="width: 84px">任务数</th>
                  <th class="right" style="width: 84px">已提交</th>
                  <th class="right" style="width: 84px">返工数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rankRows" :key="r.name">
                  <td class="muted">{{ r.rank }}</td>
                  <td>{{ r.name }}</td>
                  <td class="right mono">{{ r.time }}</td>
                  <td class="right mono">{{ r.validTime }}</td>
                  <td class="right mono">{{ r.invalidTime }}</td>
                  <td class="right">{{ r.tasks }}</td>
                  <td class="right">{{ r.submitted }}</td>
                  <td class="right">{{ r.rework }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.big-tabs { display: inline-flex; align-items: center; gap: 4px; padding: 3px; background: #f2f3f5; border-radius: 8px; }
.big-tabs button {
  height: 30px; padding: 0 14px; border: none; background: transparent; border-radius: 6px;
  font-size: 12px; color: #4e5969; cursor: pointer; font-family: inherit;
}
.big-tabs button.on { background: #1677ff; color: #fff; font-weight: 500; }
.rank-search { margin-left: auto; display: flex; gap: 8px; }
.rank-search input {
  width: 210px; height: 30px; border: 1px solid #e5e6eb; border-radius: 8px; padding: 0 10px;
  font-size: 12px; outline: none; background: #fff; color: #1f2329; font-family: inherit;
}
.rank-search input::placeholder { color: #c0c4cc; }
.sp-empty.big { padding: 96px 0 92px; }
.table-wrap { border: 1px solid #eef0f3; border-radius: 8px; margin-top: 14px; overflow: hidden; }
.table-wrap .sp-table th { background: #f7f8fa; }
.table-wrap .sp-foot { padding: 10px 14px; }
.rank-hd { margin-bottom: 0; }
.sort-tabs { display: inline-flex; align-items: center; gap: 10px; }
.sort-pill {
  height: 28px; padding: 0 12px; border: none; border-radius: 999px; background: transparent;
  color: #4e5969; font-size: 12px; cursor: pointer; font-family: inherit;
}
.sort-pill.on { background: #1677ff; color: #fff; font-weight: 500; }
.sort-text { border: none; background: transparent; color: #4e5969; font-size: 12px; cursor: pointer; font-family: inherit; }
.sort-text.on { color: #1677ff; }
.rank-table { margin-top: 14px; }
</style>
