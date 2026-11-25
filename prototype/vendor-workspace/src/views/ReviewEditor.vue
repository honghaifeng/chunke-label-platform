<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Waveform from '@/components/Waveform.vue'
import Modal from '@/components/Modal.vue'
import { db, fmtDuration, fmtTime, segmentStats, taskById } from '@/mock'
import type { Segment } from '@/mock/types'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()
const pid = Number(route.params.pid)
const task = computed(() => taskById(Number(route.params.tid))!)

const selectedId = ref<number | null>(task.value?.segments[0]?.id ?? null)
const filter = ref<'all' | 'pending' | 'rejected'>('all')
const speakerFilter = ref('全部说话人')
const sideTab = ref<'list' | 'rules'>('list')
const playhead = ref(0)
const playing = ref(false)
const speed = ref(1)
const zoom = ref(1)
const qcNode = ref(task.value?.qcNode || '质检节点 A')
const rejectTarget = ref<Segment | null>(null)
const rejectReason = ref(db.invalidReasons[0])
const rejectNote = ref('')
const showAllReject = ref(false)
const allRejectReason = ref('整体质量不达标')

let timer: number | null = null

const speakers = computed(() => Array.from(new Set(task.value.segments.map((s) => s.speaker))).sort())
const stats = computed(() => segmentStats(task.value.segments, 'qc'))
const selected = computed(() => task.value.segments.find((s) => s.id === selectedId.value))

const list = computed(() => {
  let rows = task.value.segments
  if (filter.value === 'pending') rows = rows.filter((s) => s.status === 'pending')
  if (filter.value === 'rejected') rows = rows.filter((s) => s.status === 'rejected')
  if (speakerFilter.value !== '全部说话人') rows = rows.filter((s) => s.speaker === speakerFilter.value)
  return rows
})

function select(id: number) {
  selectedId.value = id
  const s = task.value.segments.find((x) => x.id === id)
  if (s) playhead.value = s.start
}

function pass(seg: Segment) {
  seg.status = 'passed'
  seg.qcNote = ''
  toast(`#${seg.idx} 已通过`, 'ok')
}

function askReject(seg: Segment) {
  rejectTarget.value = seg
  rejectReason.value = invalidReasons[0]
  rejectNote.value = ''
}

function confirmReject() {
  const seg = rejectTarget.value
  if (!seg) return
  seg.status = 'rejected'
  seg.qcNote = `${rejectReason.value}${rejectNote.value ? ' · ' + rejectNote.value : ''}`
  rejectTarget.value = null
  toast(`#${seg.idx} 已拒绝：${seg.qcNote}`, 'info')
}

function nextOf(status: Segment['status']) {
  const rows = task.value.segments
  const start = rows.findIndex((s) => s.id === selectedId.value)
  const ordered = [...rows.slice(start + 1), ...rows.slice(0, start + 1)]
  const hit = ordered.find((s) => s.status === status)
  if (hit) select(hit.id)
  else toast(status === 'pending' ? '没有待质检的转写框了' : '没有被拒绝的转写框', 'info')
}

function submitNode() {
  if (stats.value.pending > 0) {
    toast(`还有 ${stats.value.pending} 框未质检`, 'err')
    return
  }
  task.value.status = stats.value.rejected > 0 ? '已退回' : '已通过'
  task.value.qcNode = qcNode.value
  toast(stats.value.rejected > 0 ? '节点已提交，任务退回返修' : '节点已提交，质检通过', 'ok')
  setTimeout(() => router.push(`/vendor/project/${pid}/long-audio-review`), 400)
}

function submitAllReject() {
  task.value.status = '已退回'
  task.value.segments.forEach((s) => {
    s.status = 'rejected'
    s.qcNote = allRejectReason.value
  })
  showAllReject.value = false
  toast('已整体打回，任务进入返修队列', 'ok')
  setTimeout(() => router.push(`/vendor/project/${pid}/long-audio-review`), 400)
}

function togglePlay() {
  if (playing.value) return stop()
  playing.value = true
  timer = window.setInterval(() => {
    playhead.value = Math.min(task.value.duration, playhead.value + 0.1 * speed.value)
    if (playhead.value >= task.value.duration) stop()
  }, 100)
}

function stop() {
  playing.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function audioLeft() {
  const s = selected.value
  if (!s) return
  playhead.value = s.start
  toast(`试听区间 ${fmtTime(s.start)} - ${fmtTime(s.end)}`, 'info')
}

onBeforeUnmount(stop)
</script>

<template>
  <div v-if="task" class="editor">
    <div class="ed-head">
      <button class="btn ghost sm" @click="router.push(`/vendor/project/${pid}/long-audio-review`)">← 返回</button>
      <span class="task-no">#{{ task.id }}</span>
      <span class="mono muted">{{ fmtDuration(task.duration) }}</span>
      <span class="tag orange">质检中</span>
      <div class="spacer"></div>
      <span class="muted" style="font-size: 12px">质检节点</span>
      <select v-model="qcNode" class="select sm">
        <option>质检节点 A</option>
        <option>质检节点 B</option>
      </select>
      <button class="btn sm" @click="showAllReject = true">整体打回</button>
      <button class="btn sm primary" @click="submitNode">提交节点</button>
    </div>

    <div class="ed-body">
      <div class="ed-main">
        <div class="transport">
          <button class="play" @click="togglePlay">{{ playing ? '❙❙' : '▶' }}</button>
          <span class="mono time">{{ fmtTime(playhead) }} / {{ fmtTime(task.duration) }}</span>
          <input v-model.number="playhead" type="range" min="0" :max="task.duration" step="0.1" class="range grow" />
          <select v-model.number="speed" class="select sm">
            <option :value="0.5">0.5x</option><option :value="1">1.0x</option>
            <option :value="1.5">1.5x</option><option :value="2">2.0x</option>
          </select>
          <span class="muted" style="font-size: 12px">缩放</span>
          <input v-model.number="zoom" type="range" min="1" max="6" step="0.5" class="range" style="width: 80px" />
          <button class="btn sm ghost" @click="zoom = 1; playhead = 0">全长</button>
          <button class="btn sm" @click="audioLeft">试听左侧区间</button>
        </div>

        <Waveform
          :duration="task.duration"
          :segments="task.segments"
          :speakers="speakers"
          :selected-id="selectedId"
          :zoom="zoom"
          :playhead="playhead"
          mode="qc"
          :editable="false"
          @select="select"
          @seek="(t) => (playhead = t)"
        />

        <div class="qc-bar">
          <template v-if="selected">
            <span class="tag red">#{{ selected.idx }}</span>
            <span class="muted" style="font-size: 12px">{{ selected.speaker }} · {{ fmtTime(selected.start) }} - {{ fmtTime(selected.end) }}</span>
            <div class="qc-text">{{ selected.text }}</div>
            <span v-if="selected.qcNote" class="tag orange">拒绝原因：{{ selected.qcNote }}</span>
            <div class="spacer"></div>
            <button class="btn sm" :class="{ primary: selected.status !== 'passed' }" @click="pass(selected)">通过</button>
            <button class="btn sm danger" @click="askReject(selected)">拒绝</button>
          </template>
          <span v-else class="muted">点击拉框进行质检</span>
        </div>
      </div>

      <aside class="ed-side">
        <div class="side-tabs">
          <div :class="{ on: sideTab === 'list' }" @click="sideTab = 'list'">拉框列表</div>
          <div :class="{ on: sideTab === 'rules' }" @click="sideTab = 'rules'">标注规则</div>
        </div>

        <template v-if="sideTab === 'list'">
          <div class="side-stats">
            <div><b style="color: var(--success)">{{ stats.passed }}</b><span>已通过</span></div>
            <div><b style="color: var(--brand)">{{ stats.rejected }}</b><span>已拒绝</span></div>
            <div><b>{{ stats.pending }}</b><span>待质检</span></div>
          </div>
          <div class="side-filter">
            <div class="chips">
              <span :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</span>
              <span :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待质检</span>
              <span :class="{ on: filter === 'rejected' }" @click="filter = 'rejected'">已拒绝</span>
            </div>
            <select v-model="speakerFilter" class="select" style="width: 100%; margin-top: 6px">
              <option>全部说话人</option>
              <option v-for="sp in speakers" :key="sp">{{ sp }}</option>
            </select>
            <div class="flex gap8" style="margin-top: 6px">
              <button class="btn sm grow" @click="nextOf('pending')">下一个待质检</button>
              <button class="btn sm grow" @click="nextOf('rejected')">下一个被拒</button>
            </div>
          </div>
          <div class="side-list">
            <div
              v-for="s in list"
              :key="s.id"
              class="side-item-row"
              :class="{ active: s.id === selectedId }"
              @click="select(s.id)"
            >
              <div class="row-top">
                <span class="mono">#{{ s.idx }}</span>
                <span class="tag" :class="s.status === 'passed' ? 'green' : s.status === 'rejected' ? 'red' : 'orange'">
                  {{ s.status === 'passed' ? '已通过' : s.status === 'rejected' ? '已拒绝' : '待质检' }}
                </span>
              </div>
              <div class="row-meta">{{ s.speaker }} · {{ fmtTime(s.start) }}</div>
              <div class="row-text">{{ s.text }}</div>
              <div class="row-actions">
                <button class="btn sm" @click.stop="pass(s)">通过</button>
                <button class="btn sm danger" @click.stop="askReject(s)">拒绝</button>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="rules-pane">
          <h4>质检判定口径（演示摘要）</h4>
          <ol>
            <li>拉框边界偏差超过 0.5 秒判为不合格。</li>
            <li>说话人角色标错、漏标均判为拒绝。</li>
            <li>转写文本漏字、错字超过 2 处判为拒绝。</li>
            <li>静音段、重叠区间按项目规则核对。</li>
            <li>拒绝时需选择无效原因，便于返修定位。</li>
          </ol>
        </div>
      </aside>
    </div>

    <div class="ed-foot">
      <div class="foot-head">
        <b>全部转写框（共 {{ task.segments.length }} 框）</b>
        <span class="muted">已通过 {{ stats.passed }} · 已拒绝 {{ stats.rejected }} · 待质检 {{ stats.pending }}</span>
        <div class="spacer"></div>
        <span class="muted">标注员 {{ task.assignee }}</span>
      </div>
      <div class="foot-scroll">
        <table class="table">
          <thead>
            <tr><th style="width: 64px">序号</th><th style="width: 110px">时间</th><th style="width: 74px">说话人</th><th style="width: 90px">状态</th><th>转写文本</th><th style="width: 100px">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in task.segments" :key="s.id" :class="{ selected: s.id === selectedId }" @click="select(s.id)">
              <td class="mono">#{{ s.idx }}</td>
              <td class="mono muted">{{ fmtTime(s.start) }}</td>
              <td>{{ s.speaker }}</td>
              <td>
                <span class="tag" :class="s.status === 'passed' ? 'green' : s.status === 'rejected' ? 'red' : 'orange'">
                  {{ s.status === 'passed' ? '已通过' : s.status === 'rejected' ? '已拒绝' : '待质检' }}
                </span>
              </td>
              <td>{{ s.text }}</td>
              <td @click.stop>
                <button class="btn sm ghost" @click="pass(s)">✓</button>
                <button class="btn sm ghost" style="color: var(--brand)" @click="askReject(s)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal v-if="rejectTarget" :title="`拒绝转写框 #${rejectTarget.idx}`" @close="rejectTarget = null">
      <div style="font-size: 12px; margin-bottom: 10px">
        <span class="muted">原文：</span>{{ rejectTarget.text }}
      </div>
      <label class="muted" style="font-size: 12px">无效原因</label>
      <select v-model="rejectReason" class="select" style="width: 100%; margin: 6px 0 12px">
        <option v-for="r in db.invalidReasons" :key="r">{{ r }}</option>
      </select>
      <label class="muted" style="font-size: 12px">补充说明</label>
      <textarea v-model="rejectNote" class="textarea" rows="3" style="width: 100%; margin-top: 6px" placeholder="可选，填写具体问题描述"></textarea>
      <template #foot>
        <button class="btn" @click="rejectTarget = null">取消</button>
        <button class="btn primary" @click="confirmReject">确认拒绝</button>
      </template>
    </Modal>

    <Modal v-if="showAllReject" title="整体打回" @close="showAllReject = false">
      <p style="margin: 0 0 12px" class="muted">整体打回后，当前任务全部转写框将被标记为已拒绝并进入返修队列。</p>
      <label class="muted" style="font-size: 12px">打回原因</label>
      <select v-model="allRejectReason" class="select" style="width: 100%; margin-top: 6px">
        <option>整体质量不达标</option>
        <option>说话人标注混乱</option>
        <option>转写文本与音频不符</option>
        <option>标注规则理解偏差</option>
      </select>
      <template #foot>
        <button class="btn" @click="showAllReject = false">取消</button>
        <button class="btn primary" @click="submitAllReject">确认打回</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100%; background: #fff; }
.ed-head { height: 46px; flex: 0 0 46px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--line); }
.task-no { font-family: var(--mono); font-weight: 600; font-size: 14px; }
.ed-body { flex: 1; display: flex; min-height: 0; }
.ed-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.transport { height: 40px; flex: 0 0 40px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--line); background: #fafbfc; }
.play { width: 28px; height: 28px; border-radius: 50%; border: none; background: var(--primary); color: #fff; cursor: pointer; font-size: 11px; }
.range { width: 140px; accent-color: var(--primary); }
.range.grow { flex: 1; }
.time { font-size: 12px; color: var(--ink-2); }
.qc-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--line); background: #fafbfc; min-height: 56px; flex-wrap: wrap; }
.qc-text { max-width: 46%; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-side { width: 288px; flex: 0 0 288px; border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
.side-tabs { display: flex; border-bottom: 1px solid var(--line); }
.side-tabs > div { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; cursor: pointer; color: var(--ink-2); border-bottom: 2px solid transparent; }
.side-tabs > div.on { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }
.side-stats { display: flex; padding: 10px 12px; border-bottom: 1px solid #f2f3f5; }
.side-stats > div { flex: 1; text-align: center; }
.side-stats b { display: block; font-size: 17px; font-family: var(--mono); }
.side-stats span { font-size: 11px; color: var(--ink-3); }
.side-filter { padding: 10px 12px; border-bottom: 1px solid #f2f3f5; }
.chips { display: flex; gap: 4px; }
.chips span { padding: 3px 8px; border-radius: 10px; background: #f2f3f5; font-size: 12px; color: var(--ink-2); cursor: pointer; }
.chips span.on { background: var(--primary-weak); color: var(--primary); }
.side-list { flex: 1; overflow: auto; padding: 6px; }
.side-item-row { padding: 7px 8px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; }
.side-item-row:hover { background: #fafbfc; }
.side-item-row.active { background: var(--primary-weak); border-color: var(--primary-border); }
.row-top { display: flex; justify-content: space-between; align-items: center; }
.row-top .mono { font-size: 12px; }
.row-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
.row-text { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-actions { display: flex; gap: 6px; margin-top: 6px; }
.rules-pane { padding: 14px; overflow: auto; font-size: 12px; line-height: 1.8; }
.rules-pane h4 { margin: 0 0 8px; font-size: 13px; }
.rules-pane ol { padding-left: 16px; margin: 0; color: var(--ink-2); }
.ed-foot { flex: 0 0 auto; border-top: 1px solid var(--line); }
.foot-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 12px; }
.foot-scroll { max-height: 176px; overflow: auto; }
.foot-scroll thead th { position: sticky; top: 0; z-index: 1; }
</style>
