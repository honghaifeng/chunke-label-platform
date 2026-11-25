<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/Modal.vue'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

interface QuickTool { name: string; action: '文本替换' | '删除文本'; text: string; hotkey: string }

const tools = ref<QuickTool[]>([])
const showCreate = ref(false)
const form = ref<QuickTool>({ name: '', action: '文本替换', text: '', hotkey: '' })

function openCreate() {
  form.value = { name: '', action: '文本替换', text: '', hotkey: '' }
  showCreate.value = true
}
function save() {
  if (!form.value.name.trim() || !form.value.hotkey.trim()) {
    toast('请填写规则名称与快捷键', 'err')
    return
  }
  tools.value.push({ ...form.value })
  showCreate.value = false
  toast('快捷工具已创建（演示）', 'ok')
}
function remove(i: number) {
  tools.value.splice(i, 1)
  toast('已删除（演示）', 'info')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>我的快捷工具</h1>
      <span class="sub">管理您的文本替换和删除快捷工具，可通过快捷键在标注和质检时快速执行</span>
      <button class="btn primary" @click="openCreate">
        <Icon name="plus" :size="13" color="#fff" />
        新建快捷工具
      </button>
    </div>

    <div class="hint-bar">
      <Icon name="info" :size="15" color="#3b82f6" />
      <span>快捷工具仅在标注工作台中生效。进入标注或质检任务后，将光标定位到文本编辑区域，按下已配置的快捷键即可触发对应的替换或删除操作。</span>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 260px">规则名称</th>
            <th style="width: 140px">动作类型</th>
            <th>文本内容</th>
            <th style="width: 120px">快捷键</th>
            <th style="width: 90px">操作</th>
          </tr>
        </thead>
        <tbody v-if="tools.length">
          <tr v-for="(t, i) in tools" :key="t.name + i">
            <td>{{ t.name }}</td>
            <td><span class="tag" :class="t.action === '删除文本' ? 'red' : 'blue'">{{ t.action }}</span></td>
            <td class="text-cell">{{ t.text || '—' }}</td>
            <td><span class="kbd">{{ t.hotkey }}</span></td>
            <td><button class="btn link" @click="remove(i)">删除</button></td>
          </tr>
        </tbody>
      </table>

      <div v-if="!tools.length" class="empty">
        <div class="empty-ico"><Icon name="sparkle" :size="26" color="#3b82f6" /></div>
        <p class="empty-title">还没有快捷工具</p>
        <p class="empty-sub">创建快捷工具后，可在标注和质检时通过快捷键快速执行文本替换或删除操作</p>
        <button class="btn primary" @click="openCreate">
          <Icon name="plus" :size="13" color="#fff" />
          新建快捷工具
        </button>
      </div>
    </div>

    <Modal v-if="showCreate" title="创建快捷工具" @close="showCreate = false">
      <div class="field">
        <label>规则名称 <span class="req">*</span></label>
        <input v-model="form.name" class="input" placeholder="例如：填充口头禅" />
      </div>
      <div class="field">
        <label>动作类型</label>
        <select v-model="form.action" class="select">
          <option>文本替换</option>
          <option>删除文本</option>
        </select>
      </div>
      <div class="field">
        <label>文本内容</label>
        <textarea v-model="form.text" class="textarea" rows="3" placeholder="需要替换或删除的文本"></textarea>
      </div>
      <div class="field">
        <label>快捷键 <span class="req">*</span></label>
        <input v-model="form.hotkey" class="input" placeholder="例如：Ctrl+Shift+1" />
      </div>
      <template #foot>
        <button class="btn" @click="showCreate = false">取消</button>
        <button class="btn primary" @click="save">保存</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.hint-bar {
  display: flex; align-items: flex-start; gap: 8px; margin-bottom: 16px; padding: 10px 14px;
  border: 1px solid #dbeafe; border-radius: 6px; background: #f0f7ff;
  font-size: 14px; color: #475569; line-height: 1.6;
}
.hint-bar > svg { flex: 0 0 15px; margin-top: 3px; }
.text-cell { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kbd {
  display: inline-block; padding: 1px 6px; border: 1px solid var(--line-strong); border-bottom-width: 2px;
  border-radius: 4px; background: #fafbfc; font-size: 12px; color: var(--ink-2); font-family: var(--mono);
}
.empty { padding: 46px 16px 58px; text-align: center; }
.empty-ico {
  width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px;
  background: #eff6ff; display: grid; place-items: center;
}
.empty-title { font-size: 16px; font-weight: 600; color: var(--ink-1); margin: 0 0 8px; }
.empty-sub { font-size: 14px; color: var(--ink-3); margin: 0 auto 18px; max-width: 430px; }
.req { color: var(--danger); }
</style>
