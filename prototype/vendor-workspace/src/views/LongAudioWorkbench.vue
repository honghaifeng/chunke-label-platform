<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'
</script>

<template>
  <div class="page wb">
    <div class="page-head">
      <h1><Icon name="wave" :size="22" color="#3b82f6" />长音频拉框标注</h1>
      <span class="sub">任务领取后归属于你，关闭页面不会释放；草稿实时保存，下次进入可继续。</span>
      <div class="head-actions">
        <button class="btn" @click="toast('已刷新', 'info')"><Icon name="refresh" :size="13" />刷新</button>
        <button class="btn primary" @click="toast('当前没有可领取任务', 'info')"><Icon name="download" :size="13" color="#fff" />领取任务</button>
      </div>
    </div>

    <div class="wb-title">我标注中的任务</div>
    <div class="wb-dash">暂无进行中的标注任务</div>

    <div class="wb-title">待领取任务池 <span class="wb-count">0</span></div>
    <div class="wb-dash">暂无可领取任务</div>
  </div>
</template>

<style scoped>
.page { max-width: 960px; margin: 0 auto; }
.page-head { margin: 0 0 24px; padding: 0; background: transparent; border-bottom: none; position: relative; display: block; }
.page-head h1 { display: flex; align-items: center; gap: 8px; width: auto; font-size: 20px; }
.page-head .sub { display: block; font-size: 12px; margin-top: 4px; }
.page-head .head-actions { position: absolute; right: 0; top: 0; display: flex; gap: 8px; }
.page-head .head-actions .btn { height: 28px; padding: 0 10px; border-radius: 4.8px; font-size: 12.8px; }
.wb-title { font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px; }
.wb-title + .wb-dash { margin-bottom: 24px; }
.wb-count { font-size: 12px; font-weight: 400; color: #6b7280; margin-left: 4px; }
.wb-dash {
  height: 70px; display: grid; place-items: center; padding: 24px; border: 1px dashed #e5e7eb; border-radius: 6px;
  background: transparent; font-size: 14px; color: #6b7280;
}
</style>
