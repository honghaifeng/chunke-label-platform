<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { toast } from '@/composables/toast'

const router = useRouter()
const session = useSession()
const account = ref('chunke_001')
const password = ref('demo123456')
const loading = ref(false)

function submit() {
  if (!account.value.trim()) {
    toast('请输入账号', 'err')
    return
  }
  loading.value = true
  setTimeout(() => {
    session.login(account.value.trim())
    loading.value = false
    router.push('/orgs')
  }, 260)
}
</script>

<template>
  <div class="login-page">
    <div class="login-left">
      <div class="logo"><span>标</span> 数据标注平台</div>
      <h1>供应商工作台</h1>
      <p>长音频拉框 · 质检 · 返修 · 交付全流程</p>
      <ul>
        <li>任务领取与连续标注</li>
        <li>多说话人轨道与转写联动</li>
        <li>质检逐框通过与返修对比</li>
        <li>交付批次与验收节点管理</li>
      </ul>
      <div class="hint">当前为高保真原型，使用演示数据，不连接真实环境</div>
    </div>

    <div class="login-right">
      <div class="login-card">
        <h2>账号登录</h2>
        <div class="sub muted">演示账号已预填，直接登录即可</div>
        <label>账号</label>
        <input v-model="account" class="input" placeholder="请输入手机号 / 账号" @keyup.enter="submit" />
        <label>密码</label>
        <input v-model="password" class="input" type="password" @keyup.enter="submit" />
        <button class="btn primary" style="width: 100%; height: 36px; margin-top: 18px" :disabled="loading" @click="submit">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
        <div class="foot muted">登录即代表同意《服务协议》与《隐私政策》（演示占位）</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page { display: flex; height: 100%; background: #fff; }
.login-left {
  flex: 1.1; background: linear-gradient(140deg, #1f2329 0%, #2c1a19 55%, #4a1512 100%);
  color: #fff; padding: 64px 72px; display: flex; flex-direction: column; justify-content: center;
}
.logo { display: flex; align-items: center; gap: 8px; font-size: 15px; margin-bottom: 40px; opacity: .9; }
.logo span { width: 26px; height: 26px; border-radius: 6px; background: var(--primary); display: grid; place-items: center; font-size: 13px; }
.login-left h1 { font-size: 34px; margin: 0 0 10px; }
.login-left p { color: #b9bfc8; margin: 0 0 28px; font-size: 14px; }
.login-left ul { list-style: none; padding: 0; margin: 0; color: #d7dbe2; line-height: 2.1; font-size: 13px; }
.login-left li::before { content: '·'; color: var(--primary); margin-right: 8px; font-weight: 700; }
.hint { margin-top: 40px; font-size: 12px; color: #8f96a1; border-top: 1px solid rgba(255,255,255,.1); padding-top: 16px; }
.login-right { flex: 1; display: grid; place-items: center; background: #fafbfc; }
.login-card { width: 340px; background: #fff; padding: 32px; border-radius: 10px; box-shadow: var(--shadow); }
.login-card h2 { margin: 0 0 6px; font-size: 20px; }
.login-card .sub { font-size: 12px; margin-bottom: 22px; }
.login-card label { display: block; font-size: 12px; color: var(--ink-2); margin: 14px 0 6px; }
.login-card .input { width: 100%; height: 34px; }
.foot { font-size: 11px; margin-top: 16px; text-align: center; }
</style>
