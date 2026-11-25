<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, fmtTime, taskById } from '@/mock'
import type { Segment } from '@/mock/types'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const route = useRoute()
const router = useRouter()

const compareTaskId = computed(() => Number(route.query.compareTaskId || 0))
const compareTask = computed(() => (compareTaskId.value ? taskById(compareTaskId.value) : undefined))
const diffTab = ref<'label' | 'qc' | 'accept' | 'diff'>('diff')
const diffMode = ref<'label-qc' | 'submit-accept'>('label-qc')
const zoom = ref(1)
const speed = ref(1)
const playhead = ref(0)
const playing = ref(false)
let timer: number | null = null

const rows = computed(() => db.reworkItems)
const selected = ref<(string | number)[]>([])

function openCompare(taskId: number) {
  diffTab.value = 'diff'
  router.push({ query: { ...route.query, compareTaskId: String(taskId) } })
}

function closeCompare() {
  const q = { ...route.query }
  delete q.compareTaskId
  router.push({ query: q })
  stop()
}

/* 演示差异：质检稿修正文本，验收稿再修正说话人 */
function qcText(s: Segment) {
  if (s.idx % 7 === 0) return s.text.replace('麻烦', '请')
  if (s.idx % 11 === 0) return `${s.text}（已补全）`
  return s.text
}

function acceptText(s: Segment) {
  const base = qcText(s)
  if (s.idx % 9 === 0) return base.replace('您', '你')
  return base
}

function acceptSpeaker(s: Segment) {
  return s.idx % 13 === 0 ? (s.speaker === 'S1' ? 'S2' : 'S1') : s.speaker
}

function isDiff(s: Segment) {
  return diffMode.value === 'label-qc' ? qcText(s) !== s.text : acceptText(s) !== qcText(s) || acceptSpeaker(s) !== s.speaker
}

const compareRows = computed(() => (compareTask.value ? compareTask.value.segments : []))

function togglePlay() {
  if (playing.value) return stop()
  playing.value = true
  timer = window.setInterval(() => {
    playhead.value = Math.min(compareTask.value!.duration, playhead.value + 0.1 * speed.value)
    if (playhead.value >= compareTask.value!.duration) stop()
  }, 100)
}

function stop() {
  playing.value = false
  if (timer) clearInterval(timer)
  timer = null
}

function toggleAll(e: Event) {
  const on = (e.target as HTMLInputElement).checked
  selected.value = on ? rows.value.map((r) => r.taskId) : []
}
</script>

<template>
  <div class="page">
    <template v-if="!compareTask">
      <div class="page-head">
        <h1>返修管理</h1>
        <span class="sub">查看项目全部返修数据，并批量分配给具体标注员。</span>
      </div>

      <div class="rm-card">
        <div class="rm-toolbar">
          <div class="rm-search" style="width: 361px">
            <Icon name="search" :size="14" color="#8a919f" />
            <input placeholder="按任务 ID 搜索" />
          </div>
          <div class="rm-search tone" style="width: 240px">
            <Icon name="search" :size="14" color="#8a919f" />
            <input placeholder="按标注员姓名筛选" />
          </div>
          <div class="rm-sel" style="width: 208px">
            <span>all</span>
            <Icon name="caretUpDown" :size="13" color="#8a919f" />
          </div>
          <button class="btn rm-refresh" @click="toast('已刷新', 'info')"><Icon name="refresh" :size="13" />刷新</button>
          <div class="spacer"></div>
          <button class="btn primary rm-batch" disabled><Icon name="users" :size="13" color="#fff" />批量分配（{{ selected.length }}）</button>
        </div>

        <div class="rm-tablewrap">
          <table class="rm-table">
            <thead>
              <tr>
                <th style="width: 48px; padding-left: 8px">
                  <input type="checkbox" :checked="selected.length === rows.length && rows.length > 0" @change="toggleAll" />
                </th>
                <th style="width: 118px">任务</th>
                <th style="width: 190px">返修方式</th>
                <th style="width: 226px">当前处理人</th>
                <th style="width: 118px">来源</th>
                <th style="width: 190px">返修原因</th>
                <th style="width: 190px">返修次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="7" class="rm-empty">当前没有待返修任务</td>
              </tr>
              <tr v-for="r in rows" :key="r.taskId">
                <td style="padding-left: 8px"><input v-model="selected" type="checkbox" :value="r.taskId" /></td>
                <td><a class="mono linkish" @click.stop="openCompare(r.taskId)">#{{ r.taskId }}</a></td>
                <td>{{ r.method }}</td>
                <td>{{ r.annotator }}</td>
                <td>质检拒绝</td>
                <td>{{ r.reason }}</td>
                <td>{{ r.times }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rm-foot">
          <span>共 {{ rows.length }} 条</span>
          <select class="rm-size"><option>20</option><option>50</option><option>100</option></select>
          <div class="spacer"></div>
          <button class="page-btn" disabled>上一页</button>
          <span class="pg">1 / 1</span>
          <button class="page-btn" disabled>下一页</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="page-head">
        <button class="btn ghost sm" @click="closeCompare">← 返回返修管理</button>
        <h1>#{{ compareTask.id }}</h1>
        <span class="tag orange">返修对比</span>
        <span class="muted" style="font-size: 12px">标注员 {{ compareTask.assignee }} · {{ compareTask.segments.length }} 框</span>
        <div class="spacer"></div>
        <span class="muted" style="font-size: 12px">差异模式</span>
        <select v-model="diffMode" class="select">
          <option value="label-qc">标注稿 → 质检稿</option>
          <option value="submit-accept">提交稿 → 验收稿</option>
        </select>
        <button class="btn primary" @click="toast('返修已提交（演示）', 'ok')">提交返修</button>
      </div>

      <div class="panel">
        <div class="tabs" style="padding: 0 8px">
          <div class="tab" :class="{ active: diffTab === 'label' }" @click="diffTab = 'label'">标注稿</div>
          <div class="tab" :class="{ active: diffTab === 'qc' }" @click="diffTab = 'qc'">质检稿</div>
          <div class="tab" :class="{ active: diffTab === 'accept' }" @click="diffTab = 'accept'">验收稿</div>
          <div class="tab" :class="{ active: diffTab === 'diff' }" @click="diffTab = 'diff'">差异对比</div>
        </div>

        <div class="cmp-player">
          <button class="play" @click="togglePlay">{{ playing ? '❙❙' : '▶' }}</button>
          <span class="mono" style="font-size: 12px">{{ fmtTime(playhead) }} / {{ fmtTime(compareTask.duration) }}</span>
          <input v-model.number="playhead" type="range" min="0" :max="compareTask.duration" step="0.1" class="range grow" />
          <select v-model.number="speed" class="select sm">
            <option :value="0.5">0.5x</option><option :value="1">1.0x</option>
            <option :value="1.5">1.5x</option><option :value="2">2.0x</option>
          </select>
          <span class="muted" style="font-size: 12px">缩放</span>
          <input v-model.number="zoom" type="range" min="1" max="4" step="0.5" class="range" style="width: 80px" />
          <button class="btn sm" @click="playhead = 0">全长</button>
          <button class="btn sm" @click="toast('试听左侧区间（演示）', 'info')">试听左侧区间</button>
        </div>

        <div class="cmp-scroll">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 60px">序号</th>
                <th style="width: 108px">时间</th>
                <th v-if="diffTab !== 'diff'" style="width: 74px">说话人</th>
                <th v-if="diffTab === 'diff'" style="width: 60px">变化</th>
                <th v-if="diffTab === 'label'">标注稿</th>
                <th v-if="diffTab === 'qc'">质检稿</th>
                <th v-if="diffTab === 'accept'">验收稿</th>
                <th v-if="diffTab === 'diff'" style="width: 34%">{{ diffMode === 'label-qc' ? '标注稿' : '提交稿' }}</th>
                <th v-if="diffTab === 'diff'" style="width: 34%">{{ diffMode === 'label-qc' ? '质检稿' : '验收稿' }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in compareRows" :key="s.id">
                <td class="mono">#{{ s.idx }}</td>
                <td class="mono muted">{{ fmtTime(s.start) }}</td>
                <template v-if="diffTab !== 'diff'">
                  <td>{{ diffTab === 'accept' ? acceptSpeaker(s) : s.speaker }}</td>
                  <td>{{ diffTab === 'label' ? s.text : diffTab === 'qc' ? qcText(s) : acceptText(s) }}</td>
                </template>
                <template v-else>
                  <td>
                    <span v-if="isDiff(s)" class="tag orange">差异</span>
                    <span v-else class="tag gray">一致</span>
                  </td>
                  <td :class="{ 'diff-cell': isDiff(s) }">{{ diffMode === 'label-qc' ? s.text : qcText(s) }}</td>
                  <td :class="{ 'diff-cell': isDiff(s) }">{{ diffMode === 'label-qc' ? qcText(s) : acceptText(s) }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="cmp-foot muted">
          差异高亮共 {{ compareRows.filter(isDiff).length }} 处 · 说话人变化 {{ compareRows.filter((s) => acceptSpeaker(s) !== s.speaker).length }} 处
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-head { margin: -24px -24px 24px; border-bottom: none; position: sticky; top: -24px; z-index: 5; }
.rm-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 40px 24px 36px; margin: 48px 0 0; }
.rm-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.rm-search {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px;
  border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; flex: 0 0 auto;
}
.rm-search.tone { background: #f9fafb; }
.rm-search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; color: #1e293b; }
.rm-sel {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 32px;
  padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; color: #1e293b;
  background: #fff; cursor: pointer; flex: 0 0 auto;
}
.rm-refresh { width: 80px; height: 32px; font-size: 14px; background: #f9fafb; flex: 0 0 auto; }
.rm-batch { width: 145px; height: 32px; font-size: 14px; flex: 0 0 auto; }
.rm-tablewrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.rm-table { width: 100%; border-collapse: collapse; }
.rm-table th {
  height: 40px; padding: 0 8px; background: #f8fafc; font-size: 12px; font-weight: 500;
  color: #111827; text-align: left; white-space: nowrap;
}
.rm-table td { padding: 0 8px; font-size: 14px; color: #1e293b; height: 42px; }
.rm-empty { height: 112px !important; text-align: center; color: #6b7280; }
.linkish { color: #111827; font-weight: 600; cursor: pointer; }
.rm-foot { display: flex; align-items: center; gap: 10px; padding: 18px 0 0; font-size: 14px; color: #6b7280; }
.rm-foot .spacer, .rm-toolbar .spacer { flex: 1; }
.rm-size {
  width: 80px; height: 32px; padding: 0 6px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff;
  font-size: 14px; color: #1e293b; font-family: inherit;
}
.pg { padding: 0 4px; font-size: 14px; }
.page-btn {
  height: 28px; padding: 0 10px; border: 1px solid #e5e7eb; border-radius: 4.8px; background: #fff;
  color: #cbd5e1; font-size: 12.8px; font-family: inherit;
}
.cmp-player { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); background: #fafbfc; }
.play { width: 28px; height: 28px; border-radius: 50%; border: none; background: var(--primary); color: #fff; cursor: pointer; font-size: 11px; }
.range { width: 150px; accent-color: var(--primary); }
.range.grow { flex: 1; }
.cmp-scroll { max-height: 520px; overflow: auto; }
.cmp-scroll thead th { position: sticky; top: 0; z-index: 1; }
.diff-cell { background: #fffbe6; }
.cmp-foot { padding: 8px 12px; border-top: 1px solid var(--line); font-size: 12px; }
</style>
