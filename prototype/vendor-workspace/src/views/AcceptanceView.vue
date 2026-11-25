<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, projectById } from '@/mock'
import StatusTag from '@/components/StatusTag.vue'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const pid = computed(() => Number(route.params.pid))
const project = computed(() => projectById(pid.value))
const batches = computed(() => db.batches.filter((b) => b.projectId === pid.value))
const tab = ref<'nodes' | 'batches'>('nodes')
const chip = ref('全部')

const chips = ['全部', '待提交', '待分配验收员', '验收中', '平台验收通过', '平台驳回', '申诉中', '已废弃']

const nodeRows = [
  {
    name: '20261117质检通过', annotator: '泽漆', qc: '杭州春客', tasks: '1 条/0.2h',
    accuracy: '100.00%', accuracySub: '0/90', cer: '1.0%', status: '平台验收通过',
    batch: '20261117194859_qu...', createdAt: '2026-11-17 19:48'
  },
  {
    name: '20261110质检通过', annotator: '泽漆', qc: '杭州春客', tasks: '1 条/0.2h',
    accuracy: '–', accuracySub: '', cer: '–', status: '已废弃',
    batch: '20261110134656_jrv...', createdAt: '2026-11-10 13:46'
  }
]
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>交付工作台</h1>
      <span class="sub">管理交付节点与批次，提交平台验收</span>
    </div>

    <div class="seg-row">
      <div class="seg">
        <button :class="{ on: tab === 'nodes' }" @click="tab = 'nodes'">交付节点</button>
        <button :class="{ on: tab === 'batches' }" @click="tab = 'batches'">交付批次</button>
      </div>
    </div>

    <div class="acc-body">
      <div class="acc-actions">
        <button class="btn" @click="toast('已提交平台验收（演示）', 'ok')">
          <Icon name="upload" :size="13" />提交平台验收
        </button>
        <button class="btn primary" @click="toast('已创建验收节点（演示）', 'ok')">
          <Icon name="plus" :size="13" color="#fff" />创建验收节点
        </button>
      </div>

      <div class="acc-stats">
        <div class="acc-stat">
          <div class="stat-top"><span>节点总数</span><Icon name="info" :size="12" color="#9ca3af" /></div>
          <div class="stat-value">2</div>
          <Icon class="stat-ico" name="cube" :size="16" color="#9ca3af" />
        </div>
        <div class="acc-stat">
          <div class="stat-top"><span>未组批节点</span><Icon name="info" :size="12" color="#9ca3af" /></div>
          <div class="stat-value">0</div>
          <Icon class="stat-ico" name="clipboard" :size="16" color="#9ca3af" />
        </div>
        <div class="acc-stat">
          <div class="stat-top"><span>已入批节点</span><Icon name="info" :size="12" color="#9ca3af" /></div>
          <div class="stat-value">1</div>
          <Icon class="stat-ico" name="cube" :size="16" color="#9ca3af" />
        </div>
        <div class="acc-stat">
          <div class="stat-top"><span>有效节点时长</span><Icon name="info" :size="12" color="#9ca3af" /></div>
          <div class="stat-value">0.2<span>h</span></div>
          <Icon class="stat-ico" name="clock" :size="16" color="#9ca3af" />
        </div>
      </div>

      <template v-if="tab === 'nodes'">
        <div class="acc-card">
          <div class="chip-bar">
            <button v-for="c in chips" :key="c" class="chip" :class="{ on: chip === c }" @click="chip = c">{{ c }}</button>
          </div>
          <div class="filter-row">
            <div class="sel-wrap">
              <select><option>全部标注员</option><option>泽漆</option></select>
              <Icon name="caretUpDown" :size="13" color="#9ca3af" />
            </div>
            <div class="sel-wrap">
              <select><option>全部质检员</option><option>杭州春客</option></select>
              <Icon name="caretUpDown" :size="13" color="#9ca3af" />
            </div>
            <span class="fl">句准率</span>
            <input class="mini-input" placeholder="最小值" />
            <span class="fl">句准率最大值</span>
            <input class="mini-input" placeholder="最大值" />
            <div class="spacer"></div>
            <button class="back-btn" disabled>退回返修</button>
            <span class="count">共 2 条</span>
            <button class="reset-link" @click="toast('已重置筛选', 'info')">重置筛选</button>
          </div>

          <table class="acc-table">
            <thead>
              <tr>
                <th style="width: 34.5px"><input type="checkbox" /></th>
                <th style="width: 151px">节点名称</th>
                <th style="width: 86px">标注员</th>
                <th style="width: 103px">质检员</th>
                <th style="width: 130px">任务 / 时长</th>
                <th style="width: 120px">句准率</th>
                <th style="width: 110px">综合 CER</th>
                <th style="width: 130px">节点状态</th>
                <th style="width: 200px">所属批次</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in nodeRows" :key="n.name">
                <td><input type="checkbox" /></td>
                <td><span class="node-link">{{ n.name }}</span></td>
                <td>{{ n.annotator }}</td>
                <td>{{ n.qc }}</td>
                <td>{{ n.tasks }}</td>
                <td>
                  <div class="acc">{{ n.accuracy }}</div>
                  <div v-if="n.accuracySub" class="acc-sub">{{ n.accuracySub }}</div>
                </td>
                <td>{{ n.cer }}</td>
                <td>
                  <span class="state-pill" :class="n.status === '平台验收通过' ? 'green' : 'gray'">{{ n.status }}</span>
                </td>
                <td><span class="batch-link">{{ n.batch }}</span></td>
                <td class="created">{{ n.createdAt }}</td>
              </tr>
            </tbody>
          </table>

          <div class="tbl-foot">
            <span class="muted">已选 0 个节点，其中 0 个可组批</span>
            <div class="spacer"></div>
            <span class="muted">共 2 条</span>
            <button class="page-btn" disabled>‹</button>
            <span class="muted">1 / 1</span>
            <button class="page-btn" disabled>›</button>
          </div>
        </div>
      </template>

    <template v-else>
      <div class="acc-card">
        <table class="acc-table">
          <thead>
            <tr><th style="width: 150px">批次编号</th><th>批次名称</th><th style="width: 90px">任务数</th><th style="width: 100px">时长(h)</th><th style="width: 130px">验收员</th><th style="width: 120px">状态</th><th style="width: 120px">操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="b in batches" :key="b.id">
              <td>{{ b.id }}</td>
              <td>{{ b.name }}</td>
              <td>{{ b.tasks }}</td>
              <td>{{ b.hours }}</td>
              <td>{{ b.acceptor || '—' }}</td>
              <td><StatusTag :text="b.status" /></td>
              <td>
                <button class="btn sm ghost" @click="toast(`已提交批次 ${b.id}（演示）`, 'ok')">提交</button>
                <button class="btn sm ghost" @click="router.push(`/vendor/project/${pid}/acceptance/nodes`)">节点</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="muted note">
        批次状态：待提交 / 待分配验收员 / 验收中 / 通过 / 驳回 / 申诉中 / 已废弃；节点状态：待提交 / 待分配验收员 / 验收中 / 平台验收通过 / 平台驳回 / 申诉中。
      </div>
    </template>
    </div>
  </div>
</template>

<style scoped>
.page-head { margin-bottom: 0; }
.seg-row { margin: 4px 0 8px; }
.seg { background: #f2f3f5; }
.seg button { height: 32px; padding: 0 16px; font-size: 14px; }
.seg button.on { background: #f9fafb; box-shadow: 0 1px 2px rgba(0, 0, 0, .06); }
.acc-body { padding: 24px; }
.acc-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.acc-actions .btn { height: 32px; font-size: 14px; }
.acc-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 12px; }
.acc-stat { position: relative; min-height: 92px; padding: 14px; background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(16, 24, 40, .05); }
.stat-top { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #6b7280; }
.stat-ico { position: absolute; top: 16px; right: 16px; }
.stat-value { margin-top: 8px; font-size: 20px; font-weight: 600; color: #111827; line-height: 26px; }
.stat-value span { font-size: 12px; font-weight: 400; color: #6b7280; margin-left: 2px; }
.acc-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.chip-bar { display: flex; align-items: center; gap: 4px; padding: 12px; background: #fafafa; border-bottom: 1px solid #f1f5f9; overflow-x: auto; }
.chip {
  height: 32px; padding: 0 12px; border: none; border-radius: 6px; background: transparent;
  color: #6b7280; font-size: 13px; font-family: inherit; cursor: pointer; white-space: nowrap;
}
.chip.on { background: #fff; color: #111827; font-weight: 500; box-shadow: 0 1px 2px rgba(0, 0, 0, .06); }
.filter-row { display: flex; align-items: center; gap: 8px; padding: 12px 16px; flex-wrap: wrap; }
.sel-wrap {
  position: relative; display: flex; align-items: center; width: 130px; height: 28px; padding: 0 24px 0 8px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.sel-wrap select { flex: 1; min-width: 0; border: none; outline: none; background: transparent; appearance: none; font-size: 12px; font-family: inherit; }
.sel-wrap > svg { position: absolute; right: 7px; }
.fl { font-size: 12px; color: var(--ink-3); }
.mini-input { width: 76px; height: 28px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; font-family: inherit; outline: none; }
.spacer { flex: 1; }
.back-btn {
  height: 28px; padding: 0 10px; border: 1px solid #fecaca; border-radius: 6px; background: #fff;
  color: #ef4444; font-size: 12px; font-family: inherit;
}
.back-btn:disabled { opacity: .55; }
.count { font-size: 12px; color: var(--ink-2); }
.reset-link { border: none; background: transparent; color: var(--primary); font-size: 12px; font-family: inherit; cursor: pointer; padding: 0; }
.acc-table { width: 100%; border-collapse: collapse; }
.acc-table th {
  height: 40px; padding: 0 8px; background: #f8fafc; font-size: 13px; font-weight: 500;
  color: #6b7280; text-align: left; white-space: nowrap;
}
.acc-table td { height: 55px; padding: 0 8px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
.acc-table tbody tr:last-child td { border-bottom: none; }
.node-link { color: #111827; font-weight: 500; }
.acc { font-weight: 600; color: var(--ink-1); }
.acc-sub { font-size: 11px; color: var(--ink-3); }
.state-pill { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 500; }
.state-pill.green { background: #ecfdf5; color: #059669; }
.state-pill.gray { background: #f3f4f6; color: var(--ink-3); }
.batch-link { color: var(--primary); display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.created { color: #6b7280; white-space: nowrap; }
.tbl-foot { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 12px; }
.page-btn {
  width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 4.8px; background: #fff;
  color: #9ca3af; font-size: 14px; font-family: inherit;
}
.page-btn:disabled { cursor: not-allowed; }
.note { margin-top: 12px; font-size: 11px; }
</style>
