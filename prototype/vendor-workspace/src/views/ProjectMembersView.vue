<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { projectById } from '@/mock'
import { toast } from '@/composables/toast'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const project = computed(() => projectById(Number(route.params.pid || 0)))
const tab = ref<'list' | 'qc'>('list')
const role = ref('全部角色')
const keyword = ref('')

const members = [
  { name: '泽漆', email: '', roles: ['标注员', '质检员'], joined: '2026年11月6日 18:55' },
  { name: '唐舞麟', email: '', roles: ['标注员', '质检员'], joined: '2026年11月18日 17:22' },
  { name: '柠檬', email: '', roles: ['标注员', '质检员'], joined: '2026年11月18日 17:22' },
  { name: '胡军', email: '', roles: ['标注员', '质检员'], joined: '2026年11月18日 17:22' }
]
const rows = computed(() =>
  members.filter(
    (m) =>
      (role.value === '全部角色' || m.roles.includes(role.value)) &&
      (!keyword.value || m.name.includes(keyword.value.trim()))
  )
)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ project?.name || '项目' }} · 成员管理</h1>
      <span class="sub">管理项目中的标注员、质检员和项目管理员</span>
    </div>

    <div class="page-body">
      <div class="seg">
        <button :class="{ on: tab === 'list' }" @click="tab = 'list'">成员列表</button>
        <button :class="{ on: tab === 'qc' }" @click="tab = 'qc'">质检对象分配</button>
      </div>

      <template v-if="tab === 'list'">
        <div class="filter-bar">
          <div class="sel-wrap">
            <select v-model="role">
              <option>全部角色</option>
              <option>标注员</option>
              <option>质检员</option>
              <option>项目管理员</option>
            </select>
            <Icon name="caretUpDown" :size="13" color="#9ca3af" />
          </div>
          <div class="search">
            <Icon name="search" :size="14" color="#9ca3af" />
            <input v-model="keyword" placeholder="搜索成员..." />
          </div>
          <div class="spacer"></div>
          <span class="muted small">共 {{ rows.length }} 名成员</span>
          <button class="btn primary add-btn" @click="toast('添加成员（演示）', 'info')">
            <Icon name="plus" :size="12" color="#fff" />添加成员
          </button>
        </div>

        <div class="panel member-card">
          <table class="table member-table">
            <thead><tr><th style="width: 169px">昵称</th><th style="width: 136px">邮箱</th><th style="width: 308px">角色</th><th>加入时间</th><th style="width: 150px; text-align: right">操作</th></tr></thead>
            <tbody>
              <tr v-for="m in rows" :key="m.name">
                <td>{{ m.name }}</td>
                <td class="muted">{{ m.email }}</td>
                <td>
                  <span v-for="r in m.roles" :key="r" class="role" :class="r === '标注员' ? 'green' : 'orange'">{{ r }}</span>
                </td>
                <td class="joined">{{ m.joined }}</td>
                <td style="text-align: right">
                  <button class="more-btn" @click="toast('更多操作（演示）', 'info')">
                    <Icon name="more" :size="16" color="#6b7280" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="panel">
        <div class="empty">
          <p class="empty-title">暂未分配质检对象</p>
          <p class="empty-sub">选择标注员与对应质检员后，质检对象分配关系会显示在这里。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-body { padding: 8px 8px 0; }
.seg { margin: 0 0 24px; background: #f3f4f6; border-radius: 6px; }
.seg > button { height: 32px; padding: 0 12px; font-size: 14px; border-radius: 4.8px; }
.seg > button.on { background: #f9fafb; box-shadow: none; }
.filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 29px; }
.sel-wrap {
  position: relative; display: flex; align-items: center; width: 160px; height: 32px; padding: 0 24px 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.sel-wrap select { flex: 1; min-width: 0; border: none; outline: none; background: transparent; appearance: none; font-size: 14px; font-family: inherit; }
.sel-wrap > svg { position: absolute; right: 7px; }
.search {
  display: flex; align-items: center; gap: 8px; width: 256px; height: 36px; padding: 0 10px;
  border: 1px solid var(--line); border-radius: 6px; background: #fff;
}
.search input { flex: 1; min-width: 0; border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; }
.spacer { flex: 1; }
.small { font-size: 12.8px; }
.add-btn { height: 28px; padding: 0 10px; font-size: 12.8px; }
.role { display: inline-flex; align-items: center; height: 22px; margin-right: 6px; padding: 0 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.role.green { background: #ecfdf5; color: #059669; }
.role.orange { background: #fff7ed; color: #f59e0b; }
.member-card { border-radius: 8px; overflow: hidden; }
.member-table th { height: 44.5px; padding: 14px 24px; color: #6b7280; }
.member-table td { height: 65px; padding: 16px 24px; font-size: 14px; }
.joined { font-size: 12px; color: #6b7280; }
.more-btn { width: 32px; height: 32px; display: inline-grid; place-items: center; border: none; background: transparent; border-radius: 4.8px; cursor: pointer; }
.more-btn:hover { background: #f3f4f6; }
.empty { padding: 56px 16px 64px; text-align: center; }
.empty-title { font-size: 13px; color: var(--ink-2); margin: 0 0 4px; }
.empty-sub { font-size: 12px; color: var(--ink-3); margin: 0; }
</style>
