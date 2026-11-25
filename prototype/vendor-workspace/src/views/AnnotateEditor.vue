<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const filter = ref<'all' | 'pending' | 'draft' | 'done'>('all')
const speakerFilter = ref('全部说话人')
const easyOnly = ref(false)
const zoom = ref(1)
const playhead = ref(0)
const playing = ref(false)
const speed = ref(1)
const savedAt = ref('09:12:40')
const dirty = ref(false)
const editText = ref('')
const sideTab = ref<'list' | 'rules'>('list')
const showReset = ref(false)
const showSubmitFail = ref(false)
const showDict = ref(false)
const showRules = ref(false)
const showDone = ref(false)
const footOpen = ref(true)

let timer: number | null = null

const speakers = computed(() => {
  const set = new Set(task.value.segments.map((s) => s.speaker))
  return Array.from(set).sort()
})

const selected = computed<Segment | undefined>(() => task.value?.segments.find((s) => s.id === selectedId.value))

const stats = computed(() => segmentStats(task.value.segments))

const list = computed(() => {
  let rows = task.value.segments
  if (filter.value === 'pending') rows = rows.filter((s) => s.status === 'pending')
  if (filter.value === 'draft') rows = rows.filter((s) => s.status === 'draft')
  if (filter.value === 'done') rows = rows.filter((s) => s.status === 'done')
  if (speakerFilter.value !== '全部说话人') rows = rows.filter((s) => s.speaker === speakerFilter.value)
  if (easyOnly.value) rows = rows.filter((s) => s.easy)
  return rows
})

watch(selected, (s) => {
  editText.value = s?.text ?? ''
})

function select(id: number, seek = true) {
  selectedId.value = id
  const s = task.value.segments.find((x) => x.id === id)
  if (s && seek) playhead.value = s.start
}

function onCreate(p: { start: number; end: number; speaker: string }) {
  const maxIdx = Math.max(...task.value.segments.map((s) => s.idx), 0)
  const seg: Segment = {
    id: task.value.id * 1000 + maxIdx + 500,
    idx: maxIdx + 1,
    start: p.start,
    end: p.end,
    speaker: p.speaker,
    status: 'draft',
    text: '',
    easy: true
  }
  task.value.segments.push(seg)
  select(seg.id)
  markDirty()
  toast(`已在 ${p.speaker} 轨道新建拉框`, 'ok')
}

function markDirty() {
  dirty.value = true
}

function applyText() {
  const s = selected.value
  if (!s) return
  s.text = editText.value
  if (editText.value.trim()) s.status = 'done'
  else if (s.status === 'done') s.status = 'draft'
  markDirty()
}

function setStatus(status: Segment['status']) {
  const s = selected.value
  if (!s) return
  if (status === 'done' && !s.text.trim()) {
    toast('请先填写转写文本', 'err')
    return
  }
  s.status = status
  markDirty()
}

function removeSeg() {
  if (!selected.value) return
  const id = selected.value.id
  task.value.segments = task.value.segments.filter((s) => s.id !== id)
  selectedId.value = task.value.segments[0]?.id ?? null
  markDirty()
  toast('已删除拉框', 'info')
}

function saveDraft() {
  applyText()
  savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  dirty.value = false
  toast('草稿已保存', 'ok')
}

function nextOf(status: Segment['status']) {
  const rows = task.value.segments
  const start = rows.findIndex((s) => s.id === selectedId.value)
  const ordered = [...rows.slice(start + 1), ...rows.slice(0, start + 1)]
  const hit = ordered.find((s) => s.status === status)
  if (hit) select(hit.id)
  else toast(status === 'pending' ? '没有待标注的转写框了' : '没有草稿状态的转写框了', 'info')
}

function submit() {
  applyText()
  const done = task.value.segments.filter((s) => s.status === 'done' && s.text.trim())
  if (done.length !== task.value.segments.length) {
    showSubmitFail.value = true
    return
  }
  task.value.status = '待质检'
  task.value.submittedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  db.tasks.forEach((t) => {
    if (t.id === task.value.id) Object.assign(t, task.value)
  })
  toast('标注已提交，任务进入质检队列', 'ok')
  setTimeout(() => router.push(`/vendor/project/${pid}/long-audio`), 400)
}

function doReset() {
  task.value.segments.forEach((s) => {
    s.text = ''
    s.status = 'pending'
  })
  showReset.value = false
  selectedId.value = task.value.segments[0]?.id ?? null
  savedAt.value = '未保存'
  dirty.value = true
  toast('已重置，转写框恢复为待标注', 'info')
}

function togglePlay() {
  if (playing.value) {
    stop()
    return
  }
  if (playhead.value >= task.value.duration) playhead.value = 0
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

function fullLength() {
  zoom.value = 1
  playhead.value = 0
}

onBeforeUnmount(stop)
</script>

<template>
  <div v-if="task" class="editor">
    <div class="ed-head">
      <button class="btn ghost sm" @click="router.push(`/vendor/project/${pid}/long-audio`)">← 返回</button>
      <span class="task-no">#{{ task.id }}</span>
      <span class="mono muted">{{ fmtDuration(task.duration) }}</span>
      <span class="tag blue">人工标注</span>
      <span class="save-state" :class="{ dirty }">
        <i></i>{{ dirty ? '编辑中…' : `已保存 ${savedAt}` }}
      </span>
      <div class="spacer"></div>
      <button class="btn sm" @click="showReset = true">重置重做</button>
      <button class="btn sm" @click="showDict = true">方言辞典</button>
      <button class="btn sm" @click="showRules = true">作业规则</button>
      <button class="btn sm" @click="saveDraft">保存草稿</button>
      <button class="btn sm primary" @click="submit">提交标注</button>
    </div>

    <div class="ed-body">
      <div class="ed-main">
        <div class="transport">
          <button class="play" @click="togglePlay">{{ playing ? '❙❙' : '▶' }}</button>
          <span class="mono time">{{ fmtTime(playhead) }} / {{ fmtTime(task.duration) }}</span>
          <div class="range-wrap">
            <input v-model.number="playhead" type="range" min="0" :max="task.duration" step="0.1" class="range" />
          </div>
          <select v-model.number="speed" class="select sm">
            <option :value="0.5">0.5x</option>
            <option :value="1">1.0x</option>
            <option :value="1.5">1.5x</option>
            <option :value="2">2.0x</option>
          </select>
          <span class="muted" style="font-size: 12px">缩放</span>
          <input v-model.number="zoom" type="range" min="1" max="6" step="0.5" class="range zoom" />
          <button class="btn sm ghost" @click="fullLength">全长</button>
          <span class="muted" style="font-size: 12px; margin-left: auto">在轨道空白处拖拽可新建拉框</span>
        </div>

        <Waveform
          :duration="task.duration"
          :segments="task.segments"
          :speakers="speakers"
          :selected-id="selectedId"
          :zoom="zoom"
          :playhead="playhead"
          @select="select"
          @seek="(t) => (playhead = t)"
          @create="onCreate"
        />

        <div class="seg-edit" :class="{ none: !selected }">
          <template v-if="selected">
            <div class="flex gap8" style="width: 220px">
              <span class="tag red">#{{ selected.idx }}</span>
              <select v-model="selected.speaker" class="select sm" @change="markDirty">
                <option v-for="sp in speakers" :key="sp">{{ sp }}</option>
              </select>
              <button class="btn sm ghost" @click="toast('已新增说话人 S5（演示）', 'ok')">+ 说话人</button>
            </div>
            <div class="flex gap8">
              <span class="muted" style="font-size: 12px">起</span>
              <input v-model.number="selected.start" type="number" step="0.01" class="input sm" style="width: 74px" @change="markDirty" />
              <span class="muted" style="font-size: 12px">止</span>
              <input v-model.number="selected.end" type="number" step="0.01" class="input sm" style="width: 74px" @change="markDirty" />
            </div>
            <textarea
              v-model="editText"
              class="textarea"
              rows="2"
              placeholder="请输入该拉框的转写文本"
              style="flex: 1; min-width: 240px"
              @input="markDirty"
            ></textarea>
            <div class="flex gap8">
              <button class="btn sm" @click="setStatus('draft')">存为草稿</button>
              <button class="btn sm primary" @click="applyText(); setStatus('done')">标记完成</button>
              <button class="btn sm ghost" style="color: var(--danger)" @click="removeSeg">删除</button>
            </div>
          </template>
          <div v-else class="muted" style="padding: 8px 4px">点击波形上的拉框开始编辑，或在轨道空白处拖拽新建拉框</div>
        </div>
      </div>

      <aside class="ed-side">
        <div class="side-tabs">
          <div :class="{ on: sideTab === 'list' }" @click="sideTab = 'list'">拉框列表</div>
          <div :class="{ on: sideTab === 'rules' }" @click="sideTab = 'rules'">标注规则</div>
        </div>

        <template v-if="sideTab === 'list'">
          <div class="side-stats">
            <div><b>{{ stats.done }}</b><span>已标注</span></div>
            <div><b>{{ stats.draft }}</b><span>草稿</span></div>
            <div><b>{{ stats.pending }}</b><span>待标注</span></div>
          </div>
          <div class="side-filter">
            <div class="chips">
              <span :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</span>
              <span :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待标注</span>
              <span :class="{ on: filter === 'draft' }" @click="filter = 'draft'">草稿</span>
              <span :class="{ on: filter === 'done' }" @click="filter = 'done'">已完成</span>
            </div>
            <select v-model="speakerFilter" class="select" style="width: 100%; margin-top: 6px">
              <option>全部说话人</option>
              <option v-for="sp in speakers" :key="sp">{{ sp }}</option>
            </select>
            <div class="flex gap8" style="margin-top: 6px">
              <button class="btn sm grow" @click="nextOf('pending')">下一个待标注</button>
              <button class="btn sm grow" @click="nextOf('draft')">下一个草稿</button>
            </div>
            <label class="flex gap8 muted" style="font-size: 12px; margin-top: 8px"><input v-model="easyOnly" type="checkbox" /> 仅看 easy</label>
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
                <span class="tag" :class="s.status === 'done' ? 'green' : s.status === 'draft' ? 'orange' : 'gray'">
                  {{ s.status === 'done' ? '已完成' : s.status === 'draft' ? '草稿' : '待标注' }}
                </span>
              </div>
              <div class="row-meta">{{ s.speaker }} · {{ fmtTime(s.start) }} - {{ fmtTime(s.end) }}</div>
              <div class="row-text">{{ s.text || '（空）' }}</div>
            </div>
            <div v-if="!list.length" class="empty" style="padding: 24px 8px">当前筛选下没有拉框</div>
          </div>
        </template>

        <div v-else class="rules-pane">
          <h4>长音频拉框标注规则（演示摘要）</h4>
          <ol>
            <li>按说话人分轨，同一时间只允许一个主说话人轨道。</li>
            <li>拉框边界需贴合人声，前后留白不超过 0.3 秒。</li>
            <li>转写文本需完整保留语气词、口语重复与停顿标记。</li>
            <li>超过 2 秒的静音段需拉框并标注为「静音」。</li>
            <li>多人重叠说话时，在重叠区间为上一位说话人补结束边界。</li>
            <li>不确定的方言词汇先按听到的发音转写，再在方言辞典中登记。</li>
          </ol>
        </div>
      </aside>
    </div>

    <div class="ed-foot" :class="{ collapsed: !footOpen }">
      <div class="foot-head">
        <b>全部转写框（共 {{ task.segments.length }} 框）</b>
        <span class="muted">点击任意一行可跳转到对应拉框</span>
        <div class="spacer"></div>
        <span class="muted">已标注 {{ stats.done }} / 草稿 {{ stats.draft }} / 待标注 {{ stats.pending }}</span>
        <button class="btn sm ghost" @click="footOpen = !footOpen">{{ footOpen ? '收起 ▾' : '展开 ▴' }}</button>
      </div>
      <div v-show="footOpen" class="foot-scroll">
        <table class="table">
          <thead>
            <tr><th style="width: 64px">序号</th><th style="width: 110px">时间</th><th style="width: 76px">说话人</th><th style="width: 90px">状态</th><th>转写文本</th></tr>
          </thead>
          <tbody>
            <tr
              v-for="s in task.segments"
              :key="s.id"
              :class="{ selected: s.id === selectedId }"
              @click="select(s.id)"
            >
              <td class="mono">#{{ s.idx }}</td>
              <td class="mono muted">{{ fmtTime(s.start) }} - {{ fmtTime(s.end) }}</td>
              <td>{{ s.speaker }}</td>
              <td>
                <span class="tag" :class="s.status === 'done' ? 'green' : s.status === 'draft' ? 'orange' : 'gray'">
                  {{ s.status === 'done' ? '已完成' : s.status === 'draft' ? '草稿' : '待标注' }}
                </span>
              </td>
              <td :class="{ muted: !s.text }">{{ s.text || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal v-if="showReset" title="重置重做" @close="showReset = false">
      将清空当前任务的全部转写文本，并把 {{ task.segments.length }} 个拉框恢复为「待标注」。该操作不可撤销。
      <template #foot>
        <button class="btn" @click="showReset = false">取消</button>
        <button class="btn primary" @click="doReset">确认重置</button>
      </template>
    </Modal>

    <Modal v-if="showSubmitFail" title="暂时无法提交" @close="showSubmitFail = false">
      <p style="margin: 0 0 10px">还有 {{ task.segments.length - stats.done }} 个转写框未完成：</p>
      <p class="muted" style="margin: 0">待标注 {{ stats.pending }} 框 · 草稿 {{ stats.draft }} 框。请全部标记完成后重新提交。</p>
      <template #foot>
        <button class="btn primary" @click="showSubmitFail = false">去处理</button>
      </template>
    </Modal>

    <Modal v-if="showDict" title="方言辞典" @close="showDict = false">
      <table class="table">
        <thead><tr><th>方言词</th><th>标准写法</th><th>备注</th></tr></thead>
        <tbody>
          <tr><td>晓得咯</td><td>知道了</td><td>西南官话常见语气</td></tr>
          <tr><td>莫得</td><td>没有</td><td>川渝片区</td></tr>
          <tr><td>搞么子</td><td>做什么</td><td>湘语影响区</td></tr>
        </tbody>
      </table>
      <template #foot><button class="btn" @click="showDict = false">关闭</button></template>
    </Modal>

    <Modal v-if="showRules" title="作业规则" @close="showRules = false">
      <ol style="line-height: 1.9; padding-left: 18px; margin: 0">
        <li>每框必须填写完整转写文本后才能提交。</li>
        <li>说话人切换需新建拉框，不可跨轨合并。</li>
        <li>提交后进入质检，被拒需在返修工作台处理。</li>
        <li>单任务返修超过 3 次将触发质量复核。</li>
      </ol>
      <template #foot><button class="btn" @click="showRules = false">知道了</button></template>
    </Modal>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100%; background: #fff; }
.ed-head { height: 46px; flex: 0 0 46px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--line); background: #fff; }
.task-no { font-family: var(--mono); font-weight: 600; font-size: 14px; }
.save-state { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-3); }
.save-state i { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
.save-state.dirty i { background: var(--warning); }
.ed-body { flex: 1; display: flex; min-height: 0; }
.ed-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.transport { height: 40px; flex: 0 0 40px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--line); background: #fafbfc; }
.play { width: 28px; height: 28px; border-radius: 50%; border: none; background: var(--primary); color: #fff; cursor: pointer; font-size: 11px; }
.range { width: 140px; accent-color: var(--primary); }
.range-wrap { flex: 1; min-width: 120px; display: flex; }
.range-wrap .range { width: 100%; }
.range.zoom { width: 80px; }
.time { font-size: 12px; color: var(--ink-2); }
.select.sm, .input.sm { height: 24px; font-size: 12px; }
.seg-edit { flex: 0 0 auto; min-height: 62px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid var(--line); background: #fafbfc; flex-wrap: wrap; }
.ed-side { width: 288px; flex: 0 0 288px; border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
.side-tabs { display: flex; border-bottom: 1px solid var(--line); }
.side-tabs > div { flex: 1; text-align: center; padding: 9px 0; font-size: 13px; cursor: pointer; color: var(--ink-2); border-bottom: 2px solid transparent; }
.side-tabs > div.on { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }
.side-stats { display: flex; padding: 10px 12px; gap: 6px; border-bottom: 1px solid #f2f3f5; }
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
.row-top { display: flex; align-items: center; justify-content: space-between; }
.row-top .mono { font-size: 12px; }
.row-meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
.row-text { font-size: 12px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rules-pane { padding: 14px; overflow: auto; font-size: 12px; line-height: 1.8; }
.rules-pane h4 { margin: 0 0 8px; font-size: 13px; }
.rules-pane ol { padding-left: 16px; margin: 0; color: var(--ink-2); }
.ed-foot { flex: 0 0 auto; border-top: 1px solid var(--line); background: #fff; }
.ed-foot.collapsed { flex: 0 0 auto; }
.foot-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 12px; }
.foot-scroll { max-height: 176px; overflow: auto; }
.foot-scroll thead th { position: sticky; top: 0; z-index: 1; }
</style>
