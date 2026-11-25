<script setup lang="ts">
import { computed, ref } from 'vue'
import { db } from '@/mock'
import Modal from '@/components/Modal.vue'
import Icon from '@/components/Icon.vue'
import { toast } from '@/composables/toast'

const tab = ref<'tree' | 'invite'>('tree')
const showCreate = ref(false)
const subName = ref('')
const subOrgs = ref([{ name: '杭州春客', level: 1, members: 27 }])
const selected = ref('杭州春客')
const showInvite = ref(false)
const inviteLink = ref('https://ding-tag.dingtalk.com/invite/sub-org/demo-8f3a')

const current = computed(() => subOrgs.value.find((s) => s.name === selected.value) || subOrgs.value[0])
const orgMembers = computed(() => db.members)

function create() {
  if (!subName.value.trim()) {
    toast('请输入子组织名称', 'err')
    return
  }
  subOrgs.value.push({ name: subName.value.trim(), level: 2, members: 0 })
  selected.value = subName.value.trim()
  subName.value = ''
  showCreate.value = false
  toast('子组织已创建', 'ok')
}

function copyLink() {
  navigator.clipboard?.writeText(inviteLink.value)
  toast('邀请链接已复制', 'ok')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>子组织管理</h1>
      <span class="sub">管理组织的层级结构与子组织</span>
    </div>

    <div class="tab-btns" style="margin-bottom: 14px">
      <div class="tab-btn" :class="{ on: tab === 'tree' }" @click="tab = 'tree'"><Icon name="users" :size="13" />组织结构</div>
      <div class="tab-btn" :class="{ on: tab === 'invite' }" @click="tab = 'invite'"><Icon name="userPlus" :size="13" />邀请子组织</div>
    </div>

    <div v-if="tab === 'tree'" class="two-col">
      <div class="card side-card">
        <div class="card-head"><Icon name="users" :size="14" color="#4e5969" />组织结构<span class="spacer"></span></div>
        <div class="tree">
          <div
            v-for="s in subOrgs"
            :key="s.name"
            class="tree-item"
            :class="{ active: selected === s.name }"
            :style="{ paddingLeft: (s.level - 1) * 14 + 10 + 'px' }"
            @click="selected = s.name"
          >
            <span class="tree-icon"><Icon name="home" :size="13" :color="selected === s.name ? '#1677ff' : '#8a919f'" /></span>
            <span>{{ s.name }}</span>
            <span class="count">({{ s.members }})</span>
          </div>
        </div>
      </div>

      <div class="right-col">
        <div>
          <button class="btn primary" @click="showCreate = true"><Icon name="plus" :size="12" color="#fff" />新建下级组织</button>
        </div>

        <div class="card">
          <div class="card-body">
            <div class="org-title">
              <Icon name="home" :size="14" color="#1677ff" />
              <b>{{ current.name }}</b>
              <span class="muted" style="font-size: 11px">层级 {{ current.level }}</span>
            </div>
            <div class="muted" style="font-size: 12px; margin: 2px 0 16px">{{ current.name }}</div>

            <div class="kv-grid">
              <div class="kv">
                <div class="k">管理员</div>
                <div class="v">杭州春客、denice、泽泽、周宇恩、吴文楠</div>
              </div>
              <div class="kv">
                <div class="k">上级组织</div>
                <div class="v">无</div>
              </div>
              <div class="kv">
                <div class="k">创建时间</div>
                <div class="v">2026/11/5 10:38:39</div>
              </div>
              <div class="kv">
                <div class="k">来源</div>
                <div class="v">创建</div>
              </div>
              <div class="kv">
                <div class="k">状态</div>
                <div class="v"><span class="tag green dot">启用</span></div>
              </div>
              <div class="kv">
                <div class="k">下级组织数</div>
                <div class="v">{{ subOrgs.length - 1 }}</div>
              </div>
              <div class="kv">
                <div class="k">直属成员数</div>
                <div class="v">{{ current.members }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><Icon name="user" :size="14" color="#4e5969" />直属成员（{{ current.members }}）</div>
          <div class="member-list">
            <div v-for="m in orgMembers" :key="m.id" class="member-row">
              <div class="m-name">{{ m.name }}</div>
              <div class="m-right">
                <span class="role-text">{{ m.orgRole }}</span>
                <span class="tag green dot">{{ m.status }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card" style="max-width: 560px">
      <div class="card-head">邀请子组织</div>
      <div class="card-body">
        <p class="muted" style="font-size: 12px; margin: 0 0 14px">
          将邀请链接发送给子组织管理员，对方接受后成为下级组织，可接收转分配的任务。
        </p>
        <div class="flex gap8">
          <input class="input grow" :value="inviteLink" readonly />
          <button class="btn primary" @click="copyLink"><Icon name="copy" :size="12" color="#fff" />复制链接</button>
        </div>
        <div class="muted" style="font-size: 11px; margin-top: 8px">链接有效期 7 天，过期后可重新生成。</div>
      </div>
    </div>

    <Modal v-if="showCreate" title="新建下级组织" @close="showCreate = false">
      <div class="field">
        <label>子组织名称</label>
        <input v-model="subName" class="input" placeholder="请输入子组织名称" @keyup.enter="create" />
      </div>
      <div class="field">
        <label>上级组织</label>
        <input class="input" value="杭州春客" disabled />
      </div>
      <template #foot>
        <button class="btn" @click="showCreate = false">取消</button>
        <button class="btn primary" @click="create">创建</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.two-col { display: grid; grid-template-columns: 184px 1fr; gap: 16px; align-items: start; }
.side-card { min-height: 0; }
.right-col { display: flex; flex-direction: column; gap: 14px; }
.org-title { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.kv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 24px; }
.kv .k { font-size: 12px; color: var(--ink-3); margin-bottom: 5px; }
.kv .v { font-size: 12px; line-height: 1.5; }
.member-list { padding: 0 16px; }
.member-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.member-row:last-child { border-bottom: none; }
.m-name { font-size: 12px; }
.m-right { display: flex; align-items: center; gap: 14px; }
.role-text { font-size: 12px; color: var(--ink-3); }
</style>
