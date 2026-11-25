<script setup lang="ts">
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'

const router = useRouter()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>审批管理</h1>
      <span class="sub">处理通过链接 / 邮件加入组织的成员申请</span>
    </div>

    <div class="empty">
      <div class="empty-ico"><Icon name="checkCircle" :size="24" color="#3b82f6" /></div>
      <p class="empty-title">暂无待审批请求</p>
      <p class="empty-sub">当成员通过链接申请加入或选择「需审批」加入策略时，请求会出现在这里。</p>
      <button class="btn" @click="router.push('/vendor/org/invitations')">
        <Icon name="mail" :size="13" color="#4b5563" />
        去邀请成员
      </button>
    </div>
  </div>
</template>

<style scoped>
.empty { padding: 86px 16px 96px; text-align: center; }
.empty-ico {
  width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 14px;
  background: #eff6ff; display: grid; place-items: center;
}
.empty-title { font-size: 16px; font-weight: 600; color: var(--ink-1); margin: 0 0 8px; }
.empty-sub { font-size: 14px; color: var(--ink-3); margin: 0 auto 18px; max-width: 460px; line-height: 1.6; }
</style>
