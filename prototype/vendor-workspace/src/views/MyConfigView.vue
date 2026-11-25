<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '@/composables/toast'

const langs = ref<string[]>([])
const draft = ref('')
const gender = ref('')
const birthYear = ref('')
const years = Array.from({ length: 60 }, (_, i) => String(2006 - i))

function addLang() {
  const v = draft.value.trim()
  if (!v) return
  if (langs.value.length >= 10) return toast('最多选择 10 种语言/方言', 'err')
  if (langs.value.includes(v)) return toast('该语言/方言已添加', 'err')
  langs.value.push(v)
  draft.value = ''
}
function removeLang(i: number) {
  langs.value.splice(i, 1)
}
function save() {
  if (!langs.value.length || !gender.value || !birthYear.value) return toast('请完整填写必填项', 'err')
  toast('个人配置已保存（演示）', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>我的配置</h1>
      <span class="sub">维护您的个人语言/方言和地区信息，用于录音上传时自动填充</span>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>个人配置信息</h2></div>
      <div class="panel-body">
        <div class="field">
          <label>语言/方言 <span class="req">*</span> <span class="count">已选 {{ langs.length }}/10</span></label>
          <div class="tag-input">
            <span v-for="(l, i) in langs" :key="l" class="lang-tag">
              {{ l }}
              <button class="x" aria-label="移除" @click="removeLang(i)">×</button>
            </span>
            <input
              v-model="draft"
              class="inner"
              placeholder="添加语言/方言..."
              @keydown.enter.prevent="addLang"
              @blur="addLang"
            />
          </div>
        </div>

        <div class="two">
          <div class="field">
            <label>性别 <span class="req">*</span></label>
            <select v-model="gender" class="select">
              <option value="" disabled>选择性别</option>
              <option>男</option>
              <option>女</option>
            </select>
          </div>
          <div class="field">
            <label>出生年份 <span class="req">*</span></label>
            <select v-model="birthYear" class="select">
              <option value="" disabled>选择出生年份</option>
              <option v-for="y in years" :key="y">{{ y }}</option>
            </select>
          </div>
        </div>

        <div class="actions">
          <button class="btn primary" @click="save">保存配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.req { color: var(--danger); }
.count { font-size: 11px; color: var(--ink-3); margin-left: 6px; }
.tag-input {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 34px; padding: 4px 8px;
  border: 1px solid var(--line-strong); border-radius: var(--radius); background: #fff;
}
.tag-input:focus-within { border-color: var(--primary); }
.lang-tag {
  display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 6px 0 8px;
  background: var(--primary-weak); color: var(--primary); border-radius: 3px; font-size: 12px;
}
.lang-tag .x { border: none; background: none; color: var(--primary); cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
.tag-input .inner { flex: 1; min-width: 150px; border: none; outline: none; font-size: 12px; height: 24px; font-family: inherit; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 560px; }
.actions { padding-top: 4px; }
</style>
