<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, projectById } from '@/mock'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const pid = computed(() => Number(route.params.pid || 0))
const project = computed(() => projectById(pid.value))
const scope = ref<'all' | 'mine'>('all')
const q = ref('')
const from = ref('')
const to = ref('')
const page = ref(1)

const ids = [2146028, 2146027, 2146026, 2146025, 2041025]
const names = [
  '10-15分钟_合并第3批-3.jsonl',
  '10-15分钟_合并第3批-2.jsonl',
  '10-15分钟_合并第3批-1.jsonl',
  '任务_10782811第2批-1.jsonl',
  '任务_10792318-1.jsonl'
]

function mmss(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

const rows = computed(() =>
  db.tasks
    .filter((t) => t.projectId === pid.value)
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((t) => (q.value ? String(t.id).includes(q.value.trim()) : true))
    .slice(0, 20)
    .map((t, i) => ({
      id: ids[i] || ids[0],
      name: names[i] || names[0],
      uploader: 'denice',
      duration: mmss(t.duration),
      slices: 1,
      uploadedAt: i === 4 ? '2026年11月5日 14:24' : i === 2 || i === 3 ? '2026年11月12日 23:10' : '2026年11月12日 23:11'
    }))
)

function fill() {
  toast('填写录音属性（演示）', 'info')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ project?.name || '项目' }} · 标注数据管理</h1>
      <span class="sub">管理标注数据文件的上传、VAD 切片与质量检测</span>
      <div class="head-actions">
        <button class="btn" @click="router.push(`/vendor/project/${pid}`)">返回</button>
        <button class="btn primary upload-btn" @click="router.push(`/vendor/project/${pid}/recordings/folder-upload`)">
          上传录音<Icon name="chevronDown" :size="12" color="#fff" />
        </button>
      </div>
    </div>

    <div class="page-body">
    <div class="tab-row">
      <div class="pill-tabs">
        <button class="pill-tab" :class="{ on: scope === 'all' }" @click="scope = 'all'">全部录音</button>
        <button class="pill-tab" :class="{ on: scope === 'mine' }" @click="scope = 'mine'">我的录音</button>
      </div>
      <div class="spacer"></div>
      <button class="text-btn" @click="toast('按条件无效（演示）', 'info')">
        <Icon name="checkCircle" :size="14" />按条件无效
      </button>
      <button class="text-btn" @click="toast('批量无效（演示）', 'info')">
        <Icon name="checkCircle" :size="14" />批量无效
      </button>
    </div>

    <div class="filter-row">
      <span class="fl">上传时间</span>
      <input v-model="from" type="date" class="input date" />
      <span class="tilde">~</span>
      <input v-model="to" type="date" class="input date" />
      <button class="btn" @click="toast('已筛选（演示）', 'info')">筛选</button>
      <div class="search">
        <Icon name="search" :size="14" color="#9ca3af" />
        <input v-model="q" placeholder="搜索录音 ID" />
      </div>
      <button class="btn" @click="toast('已搜索（演示）', 'info')">搜索</button>
      <div class="spacer"></div>
      <button class="text-btn" @click="toast('已导出 CSV（演示）', 'ok')">
        <Icon name="download" :size="14" />导出CSV
      </button>
      <button class="text-btn" @click="toast('上传CSV（演示）', 'info')">
        <Icon name="upload" :size="14" />上传CSV
      </button>
    </div>

    <div class="panel table-card">
      <div class="table-scroll">
        <table class="r-table">
          <thead>
            <tr>
              <th style="width: 74px">ID</th>
              <th style="width: 85.6px">播放</th>
              <th style="width: 201.6px">录音名称</th>
              <th style="width: 59.2px">上传人</th>
              <th style="width: 71.2px">原始时长</th>
              <th style="width: 68px">录音设备</th>
              <th style="width: 77.5px">说话人性别</th>
              <th style="width: 77.5px">说话人年龄</th>
              <th style="width: 77.5px">说话人城市</th>
              <th style="width: 68px">话题</th>
              <th style="width: 68px">场景</th>
              <th style="width: 72px">切片状态</th>
              <th style="width: 53px">切片数</th>
              <th style="width: 71px">切片时长</th>
              <th style="width: 58px">语言</th>
              <th style="width: 41px">方言</th>
              <th style="width: 159px">上传时间</th>
              <th style="width: 82px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td>{{ r.id }}</td>
              <td>
                <button class="play-link" @click="toast('试听（演示）', 'info')">
                  <Icon name="play" :size="13" />预览
                </button>
              </td>
              <td class="name-cell" :title="r.name">{{ r.name }}</td>
              <td>{{ r.uploader }}</td>
              <td>{{ r.duration }}</td>
              <td v-for="k in 6" :key="k" class="fill-cell">
                <button class="fill-btn" @click="fill">
                  <Icon name="plus" :size="10" color="#6b7280" />填写
                </button>
              </td>
              <td>
                <span class="done-state"><Icon name="checkCircle" :size="12" color="#10b981" />已完成</span>
              </td>
              <td>{{ r.slices }}</td>
              <td>{{ r.duration }}</td>
              <td>普通话</td>
              <td>-</td>
              <td class="muted">{{ r.uploadedAt }}</td>
              <td><button class="invalid-btn" @click="toast('已标记无效（演示）', 'info')">无效</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
      <div class="pager">
        <span class="muted">共 {{ rows.length }} 条</span>
        <div class="page-size">
          <select><option>20 条/页</option></select>
          <Icon name="caretUpDown" :size="12" color="#9ca3af" />
        </div>
        <button class="page-btn" :disabled="page <= 1" @click="page--">上一页</button>
        <span class="muted">第 {{ page }} / 1 页</span>
        <button class="page-btn" disabled>下一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head-actions { display: flex; gap: 8px; }
.upload-btn { gap: 6px; }
.page-body { padding: 8px 8px 0; }
.tab-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pill-tabs { display: flex; align-items: center; gap: 2px; padding: 4px; background: #f2f3f5; border-radius: 8px; }
.pill-tab {
  height: 28px; padding: 0 10px; border: none; border-radius: 6px; background: transparent;
  color: var(--ink-3); font-size: 12.8px; font-family: inherit; cursor: pointer;
}
.pill-tab.on { background: #fff; color: var(--ink-1); font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.text-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 6px;
  border: none; background: transparent; color: var(--ink-3); font-size: 13px;
  font-family: inherit; cursor: pointer; border-radius: 5px;
}
.text-btn:hover { background: #f3f4f6; color: var(--ink-1); }
.filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.fl { font-size: 12px; color: var(--ink-2); }
.tilde { color: var(--ink-3); font-size: 13px; }
.date { width: 132px; height: 32px; }
.date::-webkit-calendar-picker-indicator { opacity: .45; }
.search {
  display: flex; align-items: center; gap: 8px; width: 280px; height: 32px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 13px; font-family: inherit; background: transparent; }
.spacer { flex: 1; }
.table-card { padding: 0; overflow: hidden; border-radius: 8px; }
.table-scroll { overflow-x: auto; }
.r-table { width: 1465px; min-width: 1465px; border-collapse: collapse; table-layout: fixed; }
.r-table th {
  height: 40px; padding: 0 8px; background: #f8fafc; text-align: left; white-space: nowrap;
  font-size: 12px; font-weight: 500; color: var(--ink-3);
}
.r-table td {
  height: 45px; padding: 0 8px; font-size: 12px; color: var(--ink-2);
  border-top: 1px solid #f1f5f9; white-space: nowrap;
}
.r-table th:first-child, .r-table td:first-child { padding-left: 8px; }
.name-cell { overflow: hidden; text-overflow: ellipsis; }
.play-link {
  display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent;
  color: var(--primary); font-size: 12px; font-family: inherit; cursor: pointer; padding: 0;
}
.fill-cell { padding: 0 4px; }
.fill-btn {
  display: inline-flex; align-items: center; gap: 2px; height: 24px; padding: 0 6px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--ink-3);
  font-size: 12px; font-family: inherit; cursor: pointer;
}
.done-state { display: inline-flex; align-items: center; gap: 3px; color: #10b981; font-size: 12px; }
.invalid-btn { border: none; background: transparent; color: #ef4444; font-size: 12px; font-family: inherit; cursor: pointer; padding: 0; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0 0; font-size: 12px; }
.page-size {
  position: relative; display: flex; align-items: center; width: 90px; height: 28px; padding: 0 22px 0 8px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.page-size select { flex: 1; border: none; outline: none; background: transparent; appearance: none; font-size: 12px; font-family: inherit; }
.page-size > svg { position: absolute; right: 6px; }
.page-btn { border: none; background: transparent; color: var(--ink-3); font-size: 12px; font-family: inherit; cursor: pointer; padding: 0; }
.page-btn:disabled { color: #d1d5db; cursor: not-allowed; }
</style>
