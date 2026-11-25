<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import StatTile from '@/components/stats/StatTile.vue'
import TrendChart from '@/components/stats/TrendChart.vue'
import FunnelRows from '@/components/stats/FunnelRows.vue'
import { toast } from '@/composables/toast'
import { downloadCsv } from '@/composables/download'

const scope = ref<'total' | 'range'>('total')
const group = ref<'all' | 'project'>('all')
const personScope = ref('all')
const date = ref('')
const includeHoliday = ref(true)
const personTab = ref<'ann' | 'qc'>(useRoute().query.person === 'qc' ? 'qc' : 'ann')
const sortBy = ref(personTab.value === 'ann' ? '标注提交时长' : '质检提交时长')

const cards = [
  { label: '总上传时长', value: '4h 8m', sub: '录音 63 条（含切片失败与作废）' },
  { label: '有效上传时长', value: '4h 8m', sub: '有效录音 63 条 · 占 100%' },
  { label: '标注提交时长', value: '2h 31m', sub: '完成率 61%' },
  { label: '标注有效时长', value: '1h 37m', sub: '有效率 64%' },
  { label: '验收有效时长', value: '44m 14s', sub: '验收有效率 100%' }
]

const funnel = {
  base: { label: '有效上传时长', count: '63 条', dur: '4h 8m', pct: '100.0%' },
  groups: [
    {
      title: '标注环节',
      rows: [
        { label: '标注提交时长', count: '36 条', dur: '2h 31m', pct: '61.0%' },
        { label: '标注有效时长', count: '24 条', dur: '1h 37m', pct: '39.1%' },
        { label: '标注通过时长', count: '18 条', dur: '1h 10m', pct: '28.3%' }
      ]
    },
    {
      title: '质检环节',
      rows: [
        { label: '质检提交时长', count: '30 条', dur: '2h 4m', pct: '50.1%' },
        { label: '质检有效时长', count: '30 条', dur: '2h 4m', pct: '50.1%' },
        { label: '质检通过时长', count: '16 条', dur: '41m 10s', pct: '16.6%' }
      ]
    },
    {
      title: '验收环节',
      rows: [
        { label: '验收提交时长', count: '17 条', dur: '44m 14s', pct: '17.8%' },
        { label: '验收有效时长', count: '17 条', dur: '44m 14s', pct: '17.8%' }
      ]
    }
  ]
}

const annMetrics = [
  { label: '标注提交时长', value: '2h 31m', sub: '36' },
  { label: '标注有效时长', value: '1h 37m', sub: '24' },
  { label: '标注通过时长', value: '1h 10m', sub: '18' },
  { label: '驳回待返工', value: '59m 22s', sub: '' },
  { label: '人效', value: '7.0', sub: 'min/h' },
  { label: '标注 CER', value: '—', sub: '样本不足（0 字）' },
  { label: '标注句准率', value: '—', sub: '样本不足（0 句）' }
]
const qcMetrics = [
  { label: '质检提交时长', value: '2h 4m', sub: '' },
  { label: '质检有效时长', value: '2h 4m', sub: '' },
  { label: '质检通过时长', value: '41m 10s', sub: '' },
  { label: '质检驳回时长', value: '0s', sub: '' },
  { label: '人效', value: '8.9', sub: 'min/h' },
  { label: '质检 CER', value: '1.35%', sub: '基于 1.1万 字 · 17 条任务（抽检）' },
  { label: '质检句准率', value: '—', sub: '样本不足（0 句）' }
]

const trendLabels = ['11-18', '11-19', '11-20', '11-21', '11-22', '11-23', '11-24']
const trendSeries = [{ name: '有效上传时长', color: '#2563eb', values: [0, 0, 0, 0, 0, 0, 0] }]

const people = computed(() =>
  personTab.value === 'ann'
    ? [
        { rank: 1, name: '泽漆', sec: 3315, text: '55m 15s' },
        { rank: 2, name: '柠檬', sec: 2070, text: '34m 30s' },
        { rank: 3, name: '唐舞麟', sec: 1928, text: '32m 8s' },
        { rank: 4, name: '胡军', sec: 1788, text: '29m 48s' }
      ]
    : [
        { rank: 1, name: '杭州春客', sec: 6660, text: '1h 51m', count: '—' },
        { rank: 2, name: '胡军', sec: 219, text: '3m 39s', count: '—' },
        { rank: 3, name: '柠檬', sec: 147, text: '2m 27s', count: '—' },
        { rank: 4, name: '唐舞麟', sec: 29, text: '29s', count: '—' }
      ]
)
const avg = computed(() => (personTab.value === 'ann' ? 2275 : 1773))
const maxSec = computed(() => (personTab.value === 'ann' ? 3315 : 6660))
const sortLabel = computed(() => (personTab.value === 'ann' ? '标注提交时长' : '质检提交时长'))
function switchPersonTab(t: 'ann' | 'qc') {
  personTab.value = t
  sortBy.value = t === 'ann' ? '标注提交时长' : '质检提交时长'
}

function exportCsv() {
  downloadCsv('供应商质效看板.csv', [
    ['指标', '值', '说明'],
    ['总上传时长', '4h 8m', '录音 63 条（含切片失败与作废）'],
    ['有效上传时长', '4h 8m', '有效录音 63 条 · 占 100%'],
    ['标注提交时长', '2h 31m', '完成率 61%'],
    ['标注有效时长', '1h 37m', '有效率 64%'],
    ['验收有效时长', '44m 14s', '验收有效率 100%']
  ])
  toast('已导出 CSV', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="crumb">杭州春客 <span>/</span> 数据统计 <span>/</span> 质效看板</div>
      <h1>供应商质效看板</h1>
      <span class="sub">上传 → 标注 → 质检 → 验收全链路质效，支持总量与区间双口径</span>
      <div class="head-actions qa-actions">
        <span class="latest-txt"><Icon name="clock" :size="13" color="#9ca3af" />数据最新日 2026-11-24</span>
        <button class="sp-btn ghost" @click="toast('口径字典（演示）', 'info')"><Icon name="book" :size="13" />口径字典</button>
        <button class="sp-btn ghost" @click="exportCsv"><Icon name="download" :size="13" />导出 CSV</button>
        <button class="sp-btn ghost" @click="toast('已刷新', 'ok')"><Icon name="refresh" :size="13" />刷新</button>
      </div>
    </div>

    <div class="qa-filters">
      <button class="sp-btn proj-btn" @click="toast('项目范围：全部 3 个项目', 'info')">
        <Icon name="folder" :size="13" />全部 3 个项目
        <span class="updown">
          <Icon name="chevronUp" :size="10" />
          <Icon name="chevronDown" :size="10" />
        </span>
      </button>
      <div class="scope-tabs">
        <button class="scope-pill" :class="{ on: scope === 'total' }" @click="scope = 'total'">总量变动</button>
        <button class="scope-text" :class="{ on: scope === 'range' }" @click="scope = 'range'">范围内变动</button>
      </div>
      <input v-model="date" type="date" class="sp-date-input" style="width: 128px" />
      <span class="hint">只能选截止日，统计数据起点到该日的累计</span>
    </div>

    <div class="policy-grid">
      <div v-for="c in cards" :key="c.label" class="policy-card">
        <div class="lbl">{{ c.label }}<span class="sp-tip"><Icon name="help" :size="13" /></span></div>
        <div class="val">{{ c.value }}</div>
        <div class="sub">{{ c.sub }}</div>
      </div>
    </div>

    <section class="sp-panel">
      <div class="sp-panel-hd">
        <h2>数据流转漏斗</h2>
      </div>
      <p class="funnel-desc">累计口径，宽度 = 本级时长 ÷ 有效上传时长</p>
      <div class="funnel-tools">
        <div class="funnel-tabs">
          <button :class="{ on: group === 'all' }" @click="group = 'all'">整体</button>
          <button :class="{ on: group === 'project' }" @click="group = 'project'">按项目</button>
        </div>
        <select v-model="personScope" class="person-select">
          <option value="all">全部人员</option>
          <option value="ann">标注员</option>
          <option value="qc">质检员</option>
        </select>
      </div>
      <FunnelRows :base="funnel.base" :groups="funnel.groups" />
    </section>

    <div class="sp-strip section-hd">
      <Icon name="checkCircle" :size="15" color="#4e5969" />
      <h2>标注 · 质检</h2>
      <span class="desc">各轮作业量、有效量、驳回与 CER；验收结果见漏斗</span>
    </div>

    <section class="sp-panel">
      <div class="sp-panel-hd">
        <h2>标注</h2>
        <span class="spacer"></span>
        <span class="meta-txt">活跃标注员 4 人</span>
      </div>
      <div class="sp-tiles metric-tiles">
        <StatTile v-for="m in annMetrics" :key="m.label" :label="m.label" :value="m.value" :sub="m.sub" variant="tile" tip />
      </div>
    </section>

    <section class="sp-panel">
      <div class="sp-panel-hd">
        <h2>质检</h2>
        <span class="live-tag">抽检</span>
        <span class="spacer"></span>
        <span class="meta-txt">质检员 4 人</span>
      </div>
      <div class="sp-tiles metric-tiles">
        <StatTile v-for="m in qcMetrics" :key="m.label" :label="m.label" :value="m.value" :sub="m.sub" variant="tile" tip />
      </div>
    </section>

    <section class="sp-panel">
      <div class="sp-panel-hd">
        <h2>趋势</h2>
      </div>
      <p class="trend-desc">逐日事件量（非累计，含返工），按各环节动作日分布 · 横轴 2026-11-18 ~ 2026-11-24</p>
      <div class="trend-tools">
        <button class="sp-btn">有效上传时长<Icon name="chevronDown" :size="12" /></button>
        <span class="sp-tip"><Icon name="help" :size="13" /></span>
        <label class="switch">
          <input v-model="includeHoliday" type="checkbox" />
          <span class="track"></span>
          <span>包含节假日</span>
        </label>
      </div>
      <p class="trend-sub">已包含全部 7 个自然日（含节假日），日均按 7 天计算</p>
      <div class="trend-stats">
        <span>日均 <b>0s</b></span>
        <span>峰值 <b>0s</b>（2026-11-18）</span>
      </div>
      <TrendChart :labels="trendLabels" :series="trendSeries" ymode="duration" :height="260" :shade="[3, 4]" />
      <div class="new-notes" style="margin-top: 10px">
        <p>按各环节动作日落点，跨日转移属正常，不做递减校验。</p>
        <p class="amber">2026 年的节假日未维护，工作日/休息日判定可能不准 <span class="sp-tip"><Icon name="help" :size="13" /></span></p>
      </div>
    </section>

    <section class="sp-panel">
      <div class="sp-panel-hd">
        <h2>人员维度 · 从高到低</h2>
        <span class="spacer"></span>
        <div class="sp-seg">
          <button :class="{ on: personTab === 'ann' }" @click="switchPersonTab('ann')">标注员</button>
          <button :class="{ on: personTab === 'qc' }" @click="switchPersonTab('qc')">质检员</button>
        </div>
      </div>
      <p class="person-desc">点击人员展开分项目明细，虚线为当前页人均</p>
      <div class="person-tools">
        <span class="sort-lbl">排序</span>
        <select v-model="sortBy" class="person-select">
          <option>{{ sortLabel }}</option>
          <option>任务数</option>
          <option>有效时长</option>
        </select>
        <span class="sp-tip"><Icon name="help" :size="13" /></span>
        <button class="icon-btn" @click="toast('筛选条件（演示）', 'info')"><Icon name="sliders" :size="14" /></button>
      </div>
      <p class="avg-line">本页人均 <b>{{ sortLabel }} {{ personTab === 'ann' ? '37m 55s' : '29m 33s' }}</b> · 共 {{ people.length }} 人</p>

      <template v-if="people.length">
        <div class="person-list">
          <div v-for="p in people" :key="p.name" class="person-row" @click="toast(`展开 ${p.name} 的分项目明细（演示）`, 'info')">
            <span class="rank">{{ p.rank }}</span>
            <span class="name">{{ p.name }}</span>
            <div class="bar">
              <i :style="{ width: (p.sec / maxSec) * 100 + '%' }"></i>
              <span class="avg-mark" :style="{ left: (avg / maxSec) * 100 + '%' }"></span>
            </div>
            <span class="val">{{ p.text }}</span>
            <span class="cnt">{{ p.count ?? '' }}</span>
            <Icon name="chevronRight" :size="12" color="#9aa1ac" />
          </div>
        </div>
        <div class="sp-foot">
          <span class="foot-note">条宽相对本页最大值，虚线为当前页人均；「/ N」为条数（任务数，按任务去重）</span>
          <div class="sp-pager">
            <button disabled>‹</button><span>1 / 1</span><button disabled>›</button>
          </div>
        </div>
      </template>
      <div v-else class="sp-empty">
        <h3>暂无质检员数据</h3>
        <p>当前筛选条件下没有成员数据。</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.crumb { font-size: 12px; color: #8a919f; margin-bottom: 6px; }
.crumb span { margin: 0 4px; color: #c9cdd4; }
.qa-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.latest-txt { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280; margin-right: 4px; }
.qa-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.proj-btn { min-width: 150px; justify-content: flex-start; gap: 6px; font-size: 12.5px; }
.updown { display: inline-flex; flex-direction: column; margin-left: 4px; color: #9ca3af; line-height: 0; }
.scope-tabs { display: inline-flex; align-items: center; gap: 4px; }
.scope-pill {
  height: 28px; padding: 0 12px; border: none; border-radius: 5px; background: transparent;
  color: #4b5563; font-size: 12.5px; cursor: pointer; font-family: inherit;
}
.scope-pill.on { background: #eff6ff; color: #3b82f6; font-weight: 500; }
.scope-text { height: 28px; padding: 0 10px; border: none; border-radius: 5px; background: transparent; color: #4b5563; font-size: 12.5px; cursor: pointer; font-family: inherit; }
.scope-text.on { color: #3b82f6; background: #eff6ff; }
.hint { font-size: 12px; color: #6b7280; }

.policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
@media (min-width: 1280px) { .policy-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.policy-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; min-height: 104px; }
.policy-card .lbl { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; }
.policy-card .val { font-size: 22px; font-weight: 600; font-family: var(--font); margin-top: 10px; color: #111827; }
.policy-card .sub { font-size: 12px; color: #9ca3af; margin-top: 6px; }

.funnel-desc { font-size: 12px; color: #6b7280; margin: 6px 0 12px; }
.funnel-tools { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.funnel-tabs { display: inline-flex; align-items: center; gap: 20px; }
.funnel-tabs button {
  height: 30px; padding: 0; border: none; background: transparent; font-size: 13px; color: #4b5563;
  font-family: inherit; cursor: pointer; border-bottom: 2px solid transparent;
}
.funnel-tabs button.on { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 500; }
.funnel-tools .person-select { margin-left: 0; }
.person-select {
  height: 28px; padding: 0 26px 0 10px; border: 1px solid #e5e7eb; border-radius: 5px; background: #fff;
  font-size: 12.5px; color: #111827; font-family: inherit; outline: none; margin-left: 10px;
}
.section-hd { margin-top: 6px; }
.meta-txt { font-size: 12px; color: #6b7280; }
.metric-tiles { margin-top: 14px; }

.trend-desc { font-size: 12px; color: #6b7280; margin: 6px 0 12px; line-height: 1.6; }
.trend-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.trend-sub { font-size: 12px; color: #4e5969; margin: 12px 0 4px; }
.trend-stats { display: flex; gap: 14px; font-size: 12px; color: #8a919f; margin-bottom: 8px; }
.trend-stats b { color: #1f2329; font-family: var(--mono); font-weight: 600; }
.new-notes p { font-size: 12px; color: #8a919f; line-height: 1.7; margin: 3px 0; }
.new-notes p.amber { color: #d97706; display: flex; align-items: center; gap: 4px; }

.person-desc { font-size: 12px; color: #8a919f; margin: 6px 0 12px; }
.person-tools { display: flex; align-items: center; gap: 8px; }
.sort-lbl { font-size: 12px; color: #4e5969; }
.icon-btn {
  width: 30px; height: 30px; display: inline-grid; place-items: center; border: 1px solid #e5e6eb;
  border-radius: 8px; background: #fff; color: #4e5969; cursor: pointer;
}
.avg-line { font-size: 12px; color: #4e5969; margin: 12px 0 10px; }
.avg-line b { color: #1f2329; }
.person-list { display: flex; flex-direction: column; gap: 6px; }
.person-row {
  display: flex; align-items: center; gap: 12px; padding: 9px 6px; border-radius: 8px; cursor: pointer;
}
.person-row:hover { background: #f7f8fa; }
.person-row .rank { width: 20px; text-align: center; font-size: 12px; color: #4e5969; }
.person-row .name { width: 110px; font-size: 13px; color: #1f2329; }
.person-row .bar { position: relative; flex: 1; height: 10px; border-radius: 5px; background: #eef1f5; }
.person-row .bar > i { display: block; height: 100%; border-radius: 5px; background: #2563eb; }
.person-row .avg-mark { position: absolute; top: -3px; bottom: -3px; width: 0; border-left: 1px dashed #f59e0b; }
.person-row .val { width: 76px; text-align: right; font-size: 12px; font-family: var(--mono); color: #1f2329; }
.person-row .cnt { width: 32px; text-align: right; font-size: 12px; color: #9aa1ac; }
.foot-note { font-size: 11px; color: #9aa1ac; }
.sp-foot { border-top: 1px solid #f2f3f5; margin-top: 8px; }

.switch { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #4e5969; cursor: pointer; }
.switch input { display: none; }
.switch .track { width: 34px; height: 19px; border-radius: 999px; background: #d9dce2; position: relative; transition: background .15s; }
.switch .track::after {
  content: ''; position: absolute; width: 15px; height: 15px; border-radius: 50%; background: #fff;
  top: 2px; left: 2px; transition: transform .15s; box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
}
.switch input:checked + .track { background: #1677ff; }
.switch input:checked + .track::after { transform: translateX(15px); }
</style>
