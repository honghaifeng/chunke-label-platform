<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { db, projectById } from '@/mock'
import { toast } from '@/composables/toast'

const route = useRoute()
const pid = computed(() => Number(route.params.pid || 0))
const project = computed(() => (pid.value ? projectById(pid.value) : undefined))

const selected = ref<number>(pid.value || 0)
const uploaderAsAnnotator = ref(true)
const allReasons = [
  '底噪', '没有人说话', '音频内容不全', '声音听不清', '音频经过特殊处理', '直接读本',
  '敏感内容', '无声音', '非目标语种', '数据缺失', '多人说话', '唱歌/表演性语言', '错读'
]
const chosen = ref<string[]>([])
const activeProject = computed(() => projectById(selected.value))

function toggle(r: string) {
  chosen.value = chosen.value.includes(r) ? chosen.value.filter((x) => x !== r) : [...chosen.value, r]
}
function reset() {
  chosen.value = []
  uploaderAsAnnotator.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ project ? `${project.name} · 项目配置` : '项目配置' }}</h1>
      <span class="sub">配置项目级别的标注规则和无效原因选项，仅项目经理和企业管理员可编辑。</span>
    </div>

    <div class="project-row">
      <span class="fl">选择项目</span>
      <select v-model.number="selected" class="select" style="width: 280px">
        <option :value="0" disabled>请选择要配置的项目</option>
        <option v-for="p in db.projects" :key="p.id" :value="p.id">{{ p.name }}（{{ p.lang }}）</option>
      </select>
      <span v-if="activeProject" class="tag blue type-tag">{{ activeProject.type }}</span>
    </div>

    <section class="card block">
      <div class="block-row">
        <div class="block-text">
          <h3>录音上传人为标注员</h3>
          <p class="desc">
            开启后，录音上传完成时系统自动将上传人分配为标注员并锁定任务。关闭后，上传的录音不会自动分配标注员，任何有权限的标注员均可领取。
          </p>
        </div>
        <button
          class="switch"
          :class="{ on: uploaderAsAnnotator }"
          role="switch"
          :aria-checked="uploaderAsAnnotator"
          @click="uploaderAsAnnotator = !uploaderAsAnnotator"
        >
          <span class="knob"></span>
        </button>
      </div>
    </section>

    <section class="card block">
      <h3>项目无效原因配置</h3>
      <p class="desc">
        从全局无效原因中选择本项目适用的无效原因。未配置时，标注/质检/验收页面展示全部全局无效原因。配置后，仅展示已选择的无效原因。
      </p>
      <div class="group-label">ALL REASONS (CLICK TO ADD)</div>
      <div class="chips">
        <button
          v-for="r in allReasons" :key="r" class="chip" :class="{ on: chosen.includes(r) }" @click="toggle(r)"
        >
          <span class="plus">+</span>{{ r }}
        </button>
      </div>
      <div class="actions">
        <button class="btn" @click="reset">重置</button>
        <button class="btn primary" @click="toast(selected ? '项目配置已保存（演示）' : '请先选择项目', selected ? 'ok' : 'err')">保存配置</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.project-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.fl { font-size: 13px; color: var(--ink-2); }
.type-tag { margin-left: 2px; }
.block { padding: 20px 24px; margin-bottom: 14px; }
.block h3 { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
.block-row { display: flex; align-items: center; gap: 24px; }
.block-text { flex: 1; min-width: 0; }
.desc { font-size: 13px; color: var(--ink-3); line-height: 1.75; margin: 0 0 12px; }
.block-row .desc { margin-bottom: 0; }
.group-label { font-size: 11px; letter-spacing: .06em; color: var(--ink-4); margin: 14px 0 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 14px; border-radius: 16px;
  border: 1px solid transparent; background: #f5f6f8; color: var(--ink-2); font-size: 13px; cursor: pointer; transition: all .15s;
}
.chip .plus { color: var(--ink-4); font-size: 13px; }
.chip:hover { background: #eef2f8; color: var(--ink-1); }
.chip.on { background: var(--primary-weak); color: var(--primary); border-color: var(--primary-border); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.switch {
  width: 44px; height: 24px; border-radius: 12px; border: none; background: #d5d8dd; position: relative;
  cursor: pointer; padding: 0; transition: background .18s; flex: 0 0 44px;
}
.switch.on { background: var(--primary); }
.switch .knob {
  position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .18s;
}
.switch.on .knob { transform: translateX(20px); }
</style>
