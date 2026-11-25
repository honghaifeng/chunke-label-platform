<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '@/components/Modal.vue'
import { toast } from '@/composables/toast'

const started = ref(false)
const finished = ref(false)
const answers = ref<Record<number, number>>({})
const score = computed(() => {
  const right = [1, 0, 2]
  return right.reduce((s, a, i) => s + (answers.value[i] === a ? 1 : 0), 0)
})

const questions = [
  {
    q: '长音频拉框中，同一说话人的转写框边界应如何处理？',
    options: ['尽量包住整段对话，允许跨说话人', '贴合人声边界，前后留白不超过 0.3 秒', '必须精确到毫秒，不允许留白']
  },
  {
    q: '遇到超过 2 秒的静音段，正确做法是？',
    options: ['拉框并标注为「静音」', '直接跳过，不拉框', '合并到上一个转写框']
  },
  {
    q: '质检拒绝一个转写框时，必须填写？',
    options: ['只需要写备注', '不需要任何信息', '选择无效原因，可补充说明']
  }
]

function start() {
  started.value = true
}

function submit() {
  if (Object.keys(answers.value).length < questions.length) {
    toast('请完成全部题目', 'err')
    return
  }
  finished.value = true
  started.value = false
  toast(score.value >= 2 ? `考试通过，得分 ${score.value}/3` : `未通过，得分 ${score.value}/3`, score.value >= 2 ? 'ok' : 'err')
}
</script>

<template>
  <div class="page" style="max-width: 760px">
    <div class="page-head">
      <h1>入职考试</h1>
      <span class="sub">未通过考试时仅可查看项目列表</span>
      <div class="spacer"></div>
      <span class="tag" :class="finished && score >= 2 ? 'green' : finished ? 'red' : 'orange'">
        {{ finished ? (score >= 2 ? '已通过' : '未通过') : '未开始' }}
      </span>
    </div>

    <div class="panel">
      <div class="panel-body">
        <h3 style="margin: 0 0 10px; font-size: 14px">考试说明</h3>
        <ul class="rules">
          <li>共 3 道题，答对 2 题及以上视为通过。</li>
          <li>考试内容覆盖拉框边界、静音段处理与质检拒绝规范。</li>
          <li>通过后可进入项目工作台领取任务。</li>
        </ul>
        <div v-if="finished" class="result" :class="{ ok: score >= 2 }">
          本次得分 <b>{{ score }}/3</b> · {{ score >= 2 ? '已解锁任务领取权限' : '请重新参加考试' }}
        </div>
        <button class="btn primary" @click="start">{{ finished ? '重新考试' : '开始考试' }}</button>
      </div>
    </div>

    <Modal v-if="started" title="入职考试" wide @close="started = false">
      <div v-for="(q, i) in questions" :key="i" class="q">
        <div class="q-title">{{ i + 1 }}. {{ q.q }}</div>
        <label v-for="(o, j) in q.options" :key="j" class="opt">
          <input v-model="answers[i]" type="radio" :value="j" />
          <span>{{ o }}</span>
        </label>
      </div>
      <template #foot>
        <button class="btn" @click="started = false">稍后再考</button>
        <button class="btn primary" @click="submit">提交试卷</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.rules { color: var(--ink-2); font-size: 13px; line-height: 2; padding-left: 18px; margin: 0 0 16px; }
.result { background: #fff4e6; color: #d96b00; padding: 10px 12px; border-radius: var(--radius); margin-bottom: 14px; font-size: 13px; }
.result.ok { background: #e8f8f2; color: var(--success); }
.q { margin-bottom: 18px; }
.q-title { font-size: 13px; font-weight: 500; margin-bottom: 8px; }
.opt { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 6px; cursor: pointer; font-size: 13px; }
.opt:hover { border-color: var(--primary); }
</style>
