<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="empty" style="padding: 120px 16px">
    <div class="icon">⌕</div>
    <div style="font-size: 15px; color: var(--ink-2)">页面不存在</div>
    <div class="muted" style="margin-top: 6px">该路由在演示原型中未实现</div>
    <button class="btn" style="margin-top: 16px" @click="router.push('/vendor/projects')">返回项目列表</button>
  </div>
</template>
