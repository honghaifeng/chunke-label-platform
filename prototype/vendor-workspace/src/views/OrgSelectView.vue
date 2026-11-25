<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { db } from '@/mock'

const router = useRouter()
const session = useSession()

function pick(code: string) {
  session.selectOrg(code)
  router.push('/vendor/projects')
}
</script>

<template>
  <div class="org-page">
    <div class="org-head">
      <div class="logo">标</div>
      <div>
        <h1>选择组织</h1>
        <p class="muted">当前账号：{{ session.user.account }} · 演示数据</p>
      </div>
    </div>
    <div class="org-grid">
      <div v-for="o in db.orgs" :key="o.code" class="org-card" @click="pick(o.code)">
        <div class="org-avatar">{{ o.name.slice(2, 3) }}</div>
        <div class="org-info">
          <div class="org-name">{{ o.name }}</div>
          <div class="muted mono">{{ o.code }}</div>
          <div class="org-meta">
            <span class="tag red">{{ o.role }}</span>
            <span class="tag gray">供应商</span>
            <span class="muted">{{ o.members }} 名成员</span>
          </div>
        </div>
        <span class="arrow">→</span>
      </div>
    </div>
    <div class="org-tip muted">首次进入需完成入职考试，考试未通过时仅可查看项目列表</div>
  </div>
</template>

<style scoped>
.org-page { min-height: 100%; background: var(--bg); padding: 64px 0; display: flex; flex-direction: column; align-items: center; }
.org-head { display: flex; gap: 14px; align-items: center; width: 560px; margin-bottom: 26px; }
.org-head h1 { margin: 0; font-size: 20px; }
.org-head p { margin: 4px 0 0; font-size: 12px; }
.logo { width: 44px; height: 44px; border-radius: 10px; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: 18px; }
.org-grid { width: 560px; display: flex; flex-direction: column; gap: 12px; }
.org-card {
  background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 16px;
  display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all .16s;
}
.org-card:hover { border-color: var(--primary); box-shadow: var(--shadow); transform: translateY(-1px); }
.org-avatar { width: 42px; height: 42px; border-radius: 10px; background: var(--primary-weak); color: var(--primary); display: grid; place-items: center; font-size: 16px; font-weight: 600; }
.org-info { flex: 1; }
.org-name { font-size: 15px; font-weight: 600; margin-bottom: 3px; }
.org-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; }
.arrow { color: var(--ink-4); }
.org-tip { width: 560px; margin-top: 20px; font-size: 12px; }
</style>
