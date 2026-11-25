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
const preset = ref<'7' | '30'>(mode.value === 'history' ? '30' : '7')
const from = ref(mode.value === 'history' ? '2026-10-27' : '2026-11-19')
const to = ref('2026-11-25')

function pickRange(days: '7' | '30') {
  preset.value = days
  from.value = days === '7' ? '2026-11-19' : '2026-10-27'
  to.value = '2026-11-25'
}

function switchMode(m: 'realtime' | 'history') {
  mode.value = m
  pickRange(m === 'history' ? '30' : '7')
}

const realtimeFeatured = [
  { label: '任务总数', value: '0', icon: 'listTodo', tone: 'blue' as const },
  { label: '总时长', value: '—', icon: 'clock', tone: 'gray' as const },
  { label: '有效任务', value: '0', icon: 'checkCircle', tone: 'gray' as const, sub: '有效占比 0.0%' },
  { label: '有效时长', value: '—', icon: 'timer', tone: 'gray' as const }
]
const realtimeCompact = [
  { label: '标注耗时', value: '—', icon: 'penTool', tone: 'gray' as const },
  { label: '质检耗时', value: '—', icon: 'shield', tone: 'gray' as const }
]
const accuracy = [
  { label: '最终版句准率', value: '100.00%', count: '90 / 90' },
  { label: '提交版句准率', value: '100.00%', count: '86 / 86' },
  { label: '长音频规则（>60字）', value: '100.00%', count: '17 / 17' },
  { label: '短音频规则（≤60字）', value: '100.00%', count: '73 / 73' }
]

const historyFeatured = [
  { label: '总时长', value: '1h 3m 28s', icon: 'clock', tone: 'blue' as const, sub: '按时长贡献 2 人', subTone: 'green' as const, subPill: true, spark: [500, 500, 500, 500, 3800, 3800, 3800, 3800, 3800, 3800] },
  { label: '总任务数', value: '5', icon: 'list', tone: 'blue' as const, sub: '已上传 5 批 · 已提交 1' },
  { label: '已提交任务', value: '1', icon: 'send', tone: 'blue' as const, sub: '占总任务 20.0%' },
  { label: '完成率', value: '20.0%', icon: 'percent', tone: 'orange' as const, progress: 20 }
]
const historyCompact = [
  { label: '有效时长', value: '12m 11s', icon: 'clock', tone: 'gray' as const },
  { label: '已提交时长', value: '12m 11s', icon: 'clock', tone: 'gray' as const },
  { label: '已上传时长', value: '1h 3m 28s', icon: 'clock', tone: 'gray' as const },
  { label: '上传数', value: '5', icon: 'upload', tone: 'orange' as const },
  { label: '质检完成数', value: '1', icon: 'checkCircle', tone: 'gray' as const },
  { label: '质检通过数', value: '1', icon: 'shield', tone: 'gray' as const },
  { label: '质检驳回数', value: '0', icon: 'xCircle', tone: 'gray' as const },
  { label: '返工数', value: '0', icon: 'refresh', tone: 'gray' as const },
  { label: '发布完成数', value: '0', icon: 'checkCircle', tone: 'gray' as const },
  { label: '任务正确率', value: '100.0%', icon: 'percent', tone: 'gray' as const },
  { label: '质检通过率', value: '100.0%', icon: 'percent', tone: 'gray' as const },
  { label: '返工率', value: '0.0%', icon: 'percent', tone: 'gray' as const }
]

const chartLabels = ['11/05', '11/06', '11/07', '11/08', '11/09', '11/10', '11/11', '11/12', '11/13', '11/14', '11/15', '11/16', '11/17', '11/18', '11/19', '11/20', '11/21', '11/22', '11/23', '11/24']
const durationSeries = [
  { name: '总时长', color: '#2563eb', values: [900, 900, 900, 900, 900, 900, 900, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808, 3808] },
  { name: '有效时长', color: '#22d3ee', values: [731, 731, 731, 731, 731, 731, 731, 731, 290, 731, 731, 731, 731, 731, 731, 731, 731, 731, 731, 731] }
]
const taskSeries = [
  { name: '总任务数', color: '#2563eb', values: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { name: '已提交任务', color: '#06b6d4', values: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { name: '质检通过', color: '#f59e0b', values: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { name: '返工', color: '#ec4899', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
]

const rankTab = ref<'time' | 'task'>('time')
const rankRows = [
  { rank: 1, name: 'denice', time: '51m 17s', sec: 3077, validTime: '0s', invalidTime: '0s', tasks: 4, rework: 0 },
  { rank: 2, name: '泽漆', time: '12m 11s', sec: 731, validTime: '0s', invalidTime: '0s', tasks: 1, rework: 0 }
]
const rankMax = Math.max(...rankRows.map((r) => r.sec))

function exportDaily() {
  downloadCsv('项目统计-按日历史明细.csv', [
    ['日期', '任务数', '任务时长', '有效任务', '有效时长', '标注耗时', '质检耗时'],
    ['2026-11-19', '0', '0s', '0', '0s', '0s', '0s']
  ])
  toast('已导出按日历史明细', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>项目统计</h1>
      <span class="sub">查看项目整体进度、趋势与人员表现</span>
      <div class="head-actions project-actions">
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
      </aside>

      <div class="sp-main">
        <!-- ==================== 每日实时 ==================== -->
        <template v-if="mode === 'realtime'">
          <div class="sp-strip">
            <span class="live-tag">实时</span>
            <h2>每日实时统计</h2>
            <span class="desc">数据实时计算，包含统计区间内数据</span>
          </div>

          <div class="sp-grid c4">
            <StatTile v-for="c in realtimeFeatured" :key="c.label" v-bind="c" />
          </div>
          <div class="sp-grid c4">
            <StatTile v-for="c in realtimeCompact" :key="c.label" v-bind="c" variant="compact" />
          </div>

          <section class="sp-panel">
            <h2 class="panel-title">句准率（长音频）</h2>
            <div class="acc-grid">
              <div v-for="a in accuracy" :key="a.label" class="acc-item">
                <p class="lbl">{{ a.label }}</p>
                <p class="val">{{ a.value }}</p>
                <p class="cnt">{{ a.count }}</p>
              </div>
            </div>
            <table class="sp-table acc-table">
              <thead>
                <tr><th>成员</th><th class="right">有效句数</th><th class="right">合格句数</th><th class="right">句准率</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>#1708003</td>
                  <td class="right">90</td>
                  <td class="right">90</td>
                  <td class="right">100.00%</td>
                </tr>
              </tbody>
            </table>
            <p class="acc-note">句准率 = 合格句 / 有效评估句（无法评估句不入分母），按长/短规则句数加权汇总；成员表为最终版口径</p>
          </section>

          <section class="sp-panel">
            <h2 class="panel-title">标注员排行</h2>
            <div class="sp-empty">
              <div class="glyph"><Icon name="penTool" :size="28" color="#3b7ff5" /></div>
              <h3>暂无标注员数据</h3>
              <p>当前项目尚无标注员统计。</p>
            </div>
          </section>

          <section class="sp-panel">
            <h2 class="panel-title">质检员排行</h2>
            <div class="sp-empty">
              <div class="glyph"><Icon name="shield" :size="28" color="#3b7ff5" /></div>
              <h3>暂无质检员数据</h3>
              <p>当前项目尚无质检员统计。</p>
            </div>
          </section>

          <section class="sp-plain daily-sec">
            <div class="sp-panel-hd">
              <span class="live-tag">实时</span>
              <h2>按日历史明细</h2>
              <span class="desc">来自每日实时统计的按日历史记录</span>
              <div class="hd-tools">
                <button class="sp-btn" @click="exportDaily"><Icon name="download" :size="13" />导出</button>
                <button class="sp-btn" @click="pickRange('7')">近7天</button>
                <button class="sp-btn" @click="pickRange('30')">近30天</button>
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
            <h2>项目历史概览</h2>
            <span class="desc">截至所选日期范围最后一日的全量累计快照</span>
          </div>

          <div class="sp-grid c4">
            <StatTile v-for="c in historyFeatured" :key="c.label" v-bind="c" />
          </div>
          <div class="sp-grid c4">
            <StatTile v-for="c in historyCompact" :key="c.label" v-bind="c" variant="compact" />
          </div>

          <section class="sp-panel">
            <div class="sp-chart-hd">
              <Icon name="bars" :size="16" color="#4e5969" />
              <h2>每日趋势（每日累计快照） — 总时长</h2>
              <div class="legend">
                <span><i style="background: #2563eb"></i>总时长</span>
                <span><i style="background: #22d3ee"></i>有效时长</span>
              </div>
            </div>
            <TrendChart :labels="chartLabels" :series="durationSeries" :height="250" />
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
            <TrendChart :labels="chartLabels" :series="taskSeries" :height="250" />
          </section>

          <section class="sp-panel">
            <div class="sp-panel-hd rank-hd">
              <h2>协作贡献排行</h2>
              <div class="sp-dark-tabs rank-tabs">
                <button :class="{ on: rankTab === 'time' }" @click="rankTab = 'time'">按时长</button>
                <button :class="{ on: rankTab === 'task' }" @click="rankTab = 'task'">按任务数排行</button>
              </div>
            </div>
            <table class="sp-table rank-table">
              <thead>
                <tr>
                  <th style="width: 44px">#</th>
                  <th style="width: 130px">姓名</th>
                  <th></th>
                  <th style="width: 88px" class="right">时长</th>
                  <th style="width: 84px" class="right">有效时长</th>
                  <th style="width: 84px" class="right">无效时长</th>
                  <th style="width: 70px" class="right">任务数</th>
                  <th style="width: 70px" class="right">返工数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rankRows" :key="r.name">
                  <td>
                    <span class="sp-rank-badge" :class="'top' + r.rank">{{ r.rank }}</span>
                  </td>
                  <td>{{ r.name }}</td>
                  <td>
                    <div class="sp-bar" style="max-width: 420px">
                      <i :style="{ width: (r.sec / rankMax) * 100 + '%' }"></i>
                    </div>
                  </td>
                  <td class="right mono">{{ r.time }}</td>
                  <td class="right mono">{{ r.validTime }}</td>
                  <td class="right mono">{{ r.invalidTime }}</td>
                  <td class="right">{{ r.tasks }}</td>
                  <td class="right">{{ r.rework }}</td>
                </tr>
              </tbody>
            </table>
            <div class="sp-foot"><span>共 2 人</span></div>
            <div class="sp-disclaimer">数据仅供参考，实际以系统为准</div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-actions { display: flex; align-items: center; gap: 10px; }
.panel-title { font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #111827; }
.acc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; margin-bottom: 24px; }
@media (min-width: 900px) { .acc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.acc-item .lbl { font-size: 12px; color: #6b7280; margin: 0; }
.acc-item .val { font-size: 20px; font-weight: 600; font-family: var(--font); line-height: 28px; margin: 0; color: #111827; }
.acc-item .cnt { font-size: 12px; color: #6b7280; margin: 0; }
.acc-table { border: none; }
.acc-note { font-size: 12px; color: #6b7280; margin: 16px 0 0; }
.daily-sec { margin-top: 8px; }
.sp-grid { margin-bottom: 24px; }
.sp-grid + .sp-grid { margin-top: -12px; }
.acc-grid { margin-bottom: 16px; }
.rank-hd { justify-content: space-between; }
.rank-tabs { margin-left: auto; }
.rank-table { margin-top: 14px; }
.rank-table th:first-child, .rank-table td:first-child { padding-left: 0; }
.sp-bar { min-width: 120px; }
</style>
