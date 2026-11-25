<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const tab = ref<'manual' | 'interactive'>('manual')
const lang = ref('中文')
const cat = ref('全部主题')
const q = ref('')

const cats = ['全部主题', '开始使用', '按角色操作', '按业务流程', '问题排查', '规则与参考']
const groups = [
  { title: '组织管理员指南', items: ['为什么我分配不了角色？', '邀请链接发出去了，对方进不来怎么办？', '邀请成员需要审批吗？', '成员进来了但看不到项目怎么办？', '怎么把成员移到别的部门？', '怎么停用或移除一个成员？', '子组织和部门有什么区别？', '怎么创建子组织并把人拉进去？'] },
  { title: '项目经理指南', items: ['录音怎么上传，支持什么格式？', '怎么把项目分给供应商或子组织？', '组织代码（org_code）在哪看？', '组织名称和设置在哪改？', '录音传错了能删除吗？', '项目的无效原因选项在哪配置？', '待分配任务在哪看？', '怎么批量分配任务给标注员？'] },
  { title: '标注员指南', items: ['怎么批量分配任务给标注员？', '分错人了能改派吗？', '怎么把任务分给子组织？', '分配了但成员说看不到任务？', '挂起的任务在哪管理？', '项目整体进度在哪看？', '团队成员的工作量和质量在哪看？', '验收批次怎么创建？'] },
  { title: '质检员指南', items: ['什么样的任务才能进验收批次？', '批次的综合 CER 怎么算？多少算达标？', '提交平台验收后多久出结果？', '验收被驳回了怎么办？', '验收申诉怎么发起？', '考试没过能重考吗？', '为什么我领不到任务？', '任务是自己领还是等分配？'] }
]
const all = computed(() => groups.flatMap((g) => g.items.map((t) => ({ group: g.title, title: t }))))
const filtered = computed(() => (q.value ? all.value.filter((a) => a.title.includes(q.value)) : all.value))
</script>

<template>
  <div class="help">
    <header class="help-top">
      <button class="back" @click="router.push('/vendor/projects')">← 返回工作台</button>
      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'manual' }" @click="tab = 'manual'">操作手册</div>
        <div class="tab" :class="{ active: tab === 'interactive' }" @click="tab = 'interactive'">互动教学</div>
      </div>
      <div class="spacer"></div>
      <select v-model="lang" class="select">
        <option>中文</option>
        <option>English</option>
        <option>日本語</option>
      </select>
    </header>

    <div class="hero">
      <h1>今天需要什么帮助？</h1>
      <p>搜索操作步骤、常见问题、故障排查和平台规则，快速找到可执行的答案。</p>
      <input v-model="q" class="search" placeholder="搜索帮助内容，例如：邀请成员、CER、验收批次" />
      <div class="cats">
        <button v-for="c in cats" :key="c" class="chip" :class="{ on: cat === c }" @click="cat = c">{{ c }}</button>
      </div>
    </div>

    <main class="body">
      <div class="head-row">
        <h2>帮助主题</h2>
        <span class="muted small">共 248 篇</span>
      </div>

      <div v-if="!q" class="group-grid">
        <section v-for="g in groups" :key="g.title" class="group">
          <h3>{{ g.title }}</h3>
          <ul>
            <li v-for="t in g.items" :key="t">
              <a href="javascript:void(0)">{{ t }}</a>
            </li>
          </ul>
        </section>
      </div>

      <ul v-else class="result">
        <li v-for="r in filtered" :key="r.title">
          <a href="javascript:void(0)">{{ r.title }}</a>
          <span class="muted small">{{ r.group }}</span>
        </li>
        <li v-if="!filtered.length" class="muted">没有找到相关帮助内容。</li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.help { min-height: 100%; background: #fff; }
.help-top {
  display: flex; align-items: center; gap: 14px; padding: 12px 24px; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: #fff; z-index: 5;
}
.back { border: none; background: none; color: var(--ink-2); font-size: 12px; cursor: pointer; }
.back:hover { color: var(--primary); }
.help-top .tabs { border-bottom: none; }
.spacer { flex: 1; }
.small { font-size: 12px; }
.hero { padding: 40px 24px 26px; text-align: center; background: linear-gradient(180deg, #f7faff, #fff); border-bottom: 1px solid var(--line); }
.hero h1 { font-size: 24px; margin: 0 0 8px; font-weight: 600; }
.hero p { font-size: 13px; color: var(--ink-3); margin: 0 0 18px; }
.search {
  width: 560px; max-width: 100%; height: 38px; padding: 0 14px; border: 1px solid var(--line-strong);
  border-radius: 19px; font-size: 13px; outline: none; font-family: inherit;
}
.search:focus { border-color: var(--primary); }
.cats { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.chip { height: 26px; padding: 0 12px; border-radius: 13px; border: 1px solid var(--line-strong); background: #fff; font-size: 12px; color: var(--ink-2); cursor: pointer; }
.chip.on { background: var(--primary-weak); border-color: var(--primary-border); color: var(--primary); }
.body { max-width: 1120px; margin: 0 auto; padding: 24px; }
.head-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; }
.head-row h2 { font-size: 15px; margin: 0; }
.group-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.group { border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
.group h3 { font-size: 13px; margin: 0 0 8px; }
.group ul { list-style: none; margin: 0; padding: 0; }
.group li { padding: 5px 0; font-size: 12px; }
.group a { color: var(--ink-2); }
.group a:hover { color: var(--primary); }
.result { list-style: none; padding: 0; margin: 0; }
.result li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.result a { color: var(--ink-1); }
.result a:hover { color: var(--primary); }
</style>
