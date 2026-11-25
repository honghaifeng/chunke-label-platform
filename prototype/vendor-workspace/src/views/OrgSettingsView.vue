<script setup lang="ts">
import { ref } from 'vue'
import { useSession } from '@/stores/session'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const session = useSession()
const tab = ref<'basic' | 'ip'>('basic')
const orgName = ref('杭州春客')
const desc = ref('')
const industry = ref('')
const threshold = ref<number | string>('')
const applied = ref(30)

const ips = ref([
  { ip: '120.26.88.10', remark: '办公出口', at: '2026-11-05 10:40' },
  { ip: '47.96.132.25', remark: '标注机房', at: '2026-11-12 15:20' }
])
const newIp = ref('')

function saveBasic() {
  toast('组织设置已保存', 'ok')
}

function saveThreshold() {
  const v = Number(threshold.value)
  if (!Number.isInteger(v) || v < 1 || v > 100) {
    toast('请输入 1-100 的整数', 'err')
    return
  }
  applied.value = v
  toast('完成率门槛已保存', 'ok')
}

function resetThreshold() {
  threshold.value = 30
  applied.value = 30
  toast('已恢复系统默认 30%', 'info')
}

function addIp() {
  if (!newIp.value.trim()) return
  ips.value.push({ ip: newIp.value.trim(), remark: '手动添加', at: new Date().toLocaleString('zh-CN', { hour12: false }) })
  newIp.value = ''
  toast('IP 已添加', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>组织设置</h1>
      <span class="sub">管理组织的基本信息和能力配置</span>
    </div>

    <div class="tab-btns" style="margin-bottom: 18px">
      <div class="tab-btn" :class="{ on: tab === 'basic' }" @click="tab = 'basic'">基本信息</div>
      <div class="tab-btn" :class="{ on: tab === 'ip' }" @click="tab = 'ip'">IP 白名单</div>
    </div>

    <template v-if="tab === 'basic'">
      <div class="card form-card">
        <div class="card-body">
          <div class="sec-title">基本信息</div>
          <div class="sec-desc">组织的标识、名称和描述</div>

          <div class="field">
            <label>组织标识（org_code）</label>
            <input class="input" :value="session.orgCode || 'ORG24f966c4'" disabled />
            <div class="hint">系统自动生成，不可修改</div>
          </div>

          <div class="field">
            <label>组织名称</label>
            <input v-model="orgName" class="input" placeholder="请输入组织名称" />
          </div>

          <div class="field">
            <label>组织描述</label>
            <textarea v-model="desc" class="textarea" rows="2" placeholder="简要描述您的组织"></textarea>
          </div>

          <div class="field">
            <label>所属行业</label>
            <input v-model="industry" class="input" placeholder="如：互联网，教育" />
          </div>

          <div class="field">
            <label>组织能力（只读）</label>
            <div class="flex gap8">
              <span class="cap off">客户能力<Icon name="close" :size="10" /></span>
              <span class="cap on">服务商能力<Icon name="check" :size="10" /></span>
            </div>
          </div>

          <button class="btn primary" @click="saveBasic"><Icon name="save" :size="12" color="#fff" />保存设置</button>
        </div>
      </div>

      <div class="card form-card narrow" style="margin-top: 16px">
        <div class="card-body">
          <div class="sec-title">V2质检完成率默认门槛</div>
          <div class="sec-desc">按本次提交集合中已完成整本质检的台本数计算。达到门槛后可主动提交验收，也可继续质检到100%。</div>

          <div class="effective">
            <div class="eff-main">当前生效门槛：<b>{{ applied }}%</b></div>
            <div class="eff-src">来源：系统默认30%</div>
          </div>

          <div class="field" style="max-width: 200px">
            <label>完成率门槛（%）</label>
            <input v-model="threshold" class="input" placeholder="输入1-100的整数" />
            <div class="hint">仅支持1-100的整数；恢复默认请使用下方按钮。</div>
          </div>

          <div class="flex gap8">
            <button class="btn primary" @click="saveThreshold"><Icon name="save" :size="12" color="#fff" />保存</button>
            <button class="btn" @click="resetThreshold">恢复系统默认30%</button>
          </div>

          <div class="hint" style="margin-top: 14px">变更仅影响后续提交，不改变已有验收批次。</div>
        </div>
      </div>
    </template>

    <div v-else class="card form-card">
      <div class="card-head">IP 白名单</div>
      <div class="card-body">
        <p class="muted" style="font-size: 12px; margin: 0 0 12px">仅白名单内的出口 IP 可访问供应商工作台，修改后立即生效。</p>
        <div class="flex gap8" style="margin-bottom: 12px">
          <input v-model="newIp" class="input" placeholder="输入 IP 地址，如 120.26.88.10" style="width: 260px" />
          <button class="btn primary" @click="addIp"><Icon name="plus" :size="12" color="#fff" />添加</button>
        </div>
        <table class="table">
          <thead><tr><th>IP 地址</th><th>备注</th><th>添加时间</th><th style="width: 80px">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in ips" :key="item.ip">
              <td class="mono">{{ item.ip }}</td>
              <td>{{ item.remark }}</td>
              <td class="muted">{{ item.at }}</td>
              <td><button class="btn ghost sm" style="color: var(--danger)" @click="ips = ips.filter((i) => i.ip !== item.ip)">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-card { max-width: 630px; }
.form-card.narrow { max-width: 490px; }
.sec-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.sec-desc { font-size: 12px; color: var(--ink-3); margin-bottom: 20px; line-height: 1.6; }
.cap { height: 26px; display: inline-flex; align-items: center; gap: 4px; padding: 0 10px; border-radius: 4px; font-size: 12px; }
.cap.off { background: #f5f6f8; color: var(--ink-3); border: 1px solid var(--line-strong); }
.cap.on { background: var(--primary-weak); color: var(--primary); border: 1px solid var(--primary-border); }
.effective { background: #fafafa; border-radius: 4px; padding: 10px 12px; font-size: 12px; margin-bottom: 16px; }
.eff-main { color: var(--ink-1); }
.eff-main b { font-size: 13px; margin-left: 2px; }
.eff-src { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
</style>
