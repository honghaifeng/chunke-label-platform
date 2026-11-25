<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { db, projectById } from '@/mock'
import Icon from '@/components/Icon.vue'

const route = useRoute()
const router = useRouter()
const session = useSession()
const collapsed = ref(typeof window !== 'undefined' ? window.innerWidth < 1024 : false)
const mistakeOpen = ref(true)
const closedGroups = reactive(new Set<string>())

const orgName = computed(() => db.orgs.find((o) => o.code === session.orgCode)?.name || '杭州春客')
const projectId = computed(() => Number(route.params.pid || 0))
const project = computed(() => (projectId.value ? projectById(projectId.value) : undefined))
const inProject = computed(() => Boolean(project.value))
const onMistakes = computed(() => route.path === '/vendor/my-mistakes' || route.path === '/vendor/mistake-square')

const C = {
  rose: '#fb7185', blue: '#60a5fa', amber: '#f59e0b', amber4: '#fbbf24',
  indigo: '#818cf8', violet: '#a78bfa', teal: '#2dd4bf', teal5: '#14b8a6',
  sky: '#0ea5e9', stone: '#a8a29e', stone3: '#d6d3d1', emerald: '#34d399',
  emerald5: '#10b981', orange: '#fb923c'
}

const orgNav = [
  { group: '项目与团队', items: [
    { label: '项目列表', to: '/vendor/projects', ico: 'cube', color: C.blue },
    { label: '挂起任务管理', to: '/vendor/suspended-tasks', ico: 'hourglass', color: C.amber4 }
  ] },
  { group: '数据统计', items: [
    { label: '项目统计', to: '/vendor/stats', ico: 'chartColumn', color: C.indigo },
    { label: '我的统计', to: '/vendor/my-stats', ico: 'user', color: C.violet },
    { label: '团队统计', to: '/vendor/org-stats', ico: 'users', color: C.teal },
    { label: '质效看板', to: '/vendor/quality-dashboard', ico: 'bars', color: C.sky }
  ] },
  { group: '组织管理', items: [
    { label: '组织设置', to: '/vendor/org/settings', ico: 'gear', color: C.stone },
    { label: '成员管理', to: '/vendor/org/member-center', ico: 'tree', color: C.indigo },
    { label: '子组织管理', to: '/vendor/org/sub-orgs', ico: 'tree', color: C.teal5 },
    { label: '部门管理', to: '/vendor/org/departments', ico: 'grid', color: C.amber },
    { label: '邀请成员', to: '/vendor/org/invitations', ico: 'mail', color: C.emerald },
    { label: '审批管理', to: '/vendor/org/approvals', ico: 'checkCircle', color: C.emerald },
    { label: '用户配置管理', to: '/vendor/user-configs', ico: 'gear', color: C.stone },
    { label: '项目配置', to: '/vendor/project-config', ico: 'sliders', color: C.indigo },
    { label: '我的配置', to: '/vendor/my-config', ico: 'userCog', color: C.orange },
    { label: '我的快捷工具', to: '/vendor/annotation-rules', ico: 'sparkle', color: C.amber4 }
  ] }
]

const projectNav = computed(() => {
  const p = projectId.value
  return [
    { group: '任务与数据', items: [
      { label: '标注数据管理', to: `/vendor/project/${p}/recordings`, ico: 'mic', color: C.blue },
      { label: '长音频标注任务', to: `/vendor/project/${p}/long-audio-tasks`, ico: 'list', color: C.amber },
      { label: '长音频标注和质检明细', to: `/vendor/project/${p}/long-audio-work-details`, ico: 'bars', color: C.indigo }
    ] },
    { group: '生产工作台', items: [
      { label: '长音频工作台', to: `/vendor/project/${p}/long-audio`, ico: 'wave', color: C.violet },
      { label: '长音频质检工作台', to: `/vendor/project/${p}/long-audio-review`, ico: 'shield', color: C.emerald5 },
      { label: '返修工作台', to: `/vendor/project/${p}/rework`, ico: 'warning', color: C.amber },
      { label: '返修管理', to: `/vendor/project/${p}/rework-management`, ico: 'userCog', color: C.orange },
      { label: '交付工作台', to: `/vendor/project/${p}/acceptance`, ico: 'clipboard', color: C.teal }
    ] },
    { group: '项目与团队', items: [
      { label: '任务分配', to: `/vendor/projects/${p}/allocate`, ico: 'list', color: C.violet },
      { label: '挂起任务管理', to: `/vendor/project/${p}/suspended-tasks`, ico: 'hourglass', color: C.amber4 },
      { label: '成员管理', to: `/vendor/project/${p}/members`, ico: 'userCog', color: C.orange }
    ] },
    { group: '数据统计', items: [
      { label: '项目统计', to: `/vendor/project/${p}/stats`, ico: 'chartColumn', color: C.indigo },
      { label: '我的统计', to: `/vendor/project/${p}/my-stats`, ico: 'user', color: C.violet }
    ] }
  ]
})

const navGroups = computed(() => (inProject.value ? projectNav.value : orgNav))

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function toggleGroup(name: string) {
  if (closedGroups.has(name)) closedGroups.delete(name)
  else closedGroups.add(name)
}

function goProjects() {
  router.push('/vendor/projects')
}

function onResize() {
  collapsed.value = window.innerWidth < 1024
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="app-shell">
    <aside class="app-side" :class="{ collapsed }">
      <div class="side-head" @click="goProjects">
        <span class="side-logo">
          <svg viewBox="0 0 34 34" width="36" height="36" aria-hidden="true">
            <circle cx="17" cy="19" r="12" fill="#cfc6b8" />
            <ellipse cx="17" cy="23" rx="7.6" ry="6.4" fill="#faf7f1" />
            <circle cx="13.4" cy="16" r="2.5" fill="#fff" />
            <circle cx="20.6" cy="16" r="2.5" fill="#fff" />
            <circle cx="13.9" cy="16.4" r="1.15" fill="#2b2f36" />
            <circle cx="21.1" cy="16.4" r="1.15" fill="#2b2f36" />
            <path d="M15.3 19.6h3.4l-1.7 2.1z" fill="#f2a03d" />
            <path d="M20.5 9.4c1.4-.8 2.9-.6 3.9.4" stroke="#b9b0a2" stroke-width="1.2" fill="none" stroke-linecap="round" />
            <path d="M23.6 10.4 27 13.8l-8 8-3.4.4.4-3.4z" fill="#f5a623" />
            <path d="m23.6 10.4 3.4 3.4 1.6-1.6-3.4-3.4z" fill="#ffcf5c" />
            <circle cx="27.6" cy="7.4" r="4.6" fill="#fff" stroke="#e8e2d8" />
            <path d="M25.9 9.3 27.6 4.9l1.7 4.4M26.5 7.8h2.2" stroke="#f5222d" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="side-head-txt">
          <span class="side-title">供应商工作台</span>
          <span class="side-org">{{ orgName }}</span>
        </span>
      </div>
      <div class="side-sep"></div>

      <div v-if="inProject" class="proj-banner">
        <div class="proj-row">
          <span class="proj-dot"></span>
          <span class="proj-name">{{ project?.name }}</span>
          <span class="proj-type">长音频拉框</span>
          <button class="proj-swap" title="切换项目" @click="goProjects">
            <Icon name="swap" :size="14" color="#6b7280" />
          </button>
        </div>
        <button class="proj-back" @click="goProjects">
          <Icon name="home" :size="12" color="#6b7280" />
          <span>返回首页</span>
        </button>
      </div>

      <nav>
        <template v-if="!inProject">
          <div class="side-group" @click="toggleGroup('__mistakes')">
            <span>任务与数据</span>
            <Icon
              name="chevronDown" :size="12" color="#9ca3af" class="chev"
              :class="{ closed: closedGroups.has('__mistakes') }"
            />
          </div>
          <template v-if="!closedGroups.has('__mistakes')">
            <div class="side-item" :class="{ active: onMistakes }" @click="mistakeOpen = !mistakeOpen">
              <span class="ico"><Icon name="book" :size="17" :color="C.rose" /></span>
              <span class="label">错题集</span>
              <Icon name="chevronRight" :size="12" color="#9ca3af" class="chev" />
            </div>
            <template v-if="mistakeOpen">
              <div
                class="side-item sub"
                :class="{ active: route.path === '/vendor/my-mistakes' }"
                @click="router.push('/vendor/my-mistakes')"
              >
                <span class="ico"><Icon name="book" :size="17" :color="C.rose" /></span>
                <span class="label">我的错题集</span>
              </div>
              <div
                class="side-item sub"
                :class="{ active: route.path === '/vendor/mistake-square' }"
                @click="router.push('/vendor/mistake-square')"
              >
                <span class="ico"><Icon name="book" :size="17" :color="C.rose" /></span>
                <span class="label">错题广场</span>
              </div>
            </template>
          </template>
        </template>

        <template v-for="g in navGroups" :key="g.group">
          <div class="side-group" @click="toggleGroup(g.group)">
            <span>{{ g.group }}</span>
            <Icon
              name="chevronDown" :size="12" color="#9ca3af" class="chev"
              :class="{ closed: closedGroups.has(g.group) }"
            />
          </div>
          <template v-if="!closedGroups.has(g.group)">
            <div
              v-for="item in g.items"
              :key="item.to"
              class="side-item"
              :class="{ active: isActive(item.to) }"
              :title="item.label"
              @click="router.push(item.to)"
            >
              <span class="ico"><Icon :name="item.ico" :size="17" :color="item.color" /></span>
              <span class="label">{{ item.label }}</span>
            </div>
          </template>
        </template>

        <div class="side-group"><span>工作台</span></div>
        <div class="side-item" title="切换工作台" @click="router.push('/orgs')">
          <span class="ico"><Icon name="swap" :size="17" :color="C.stone3" /></span>
          <span class="label">切换工作台</span>
        </div>
      </nav>

      <div class="side-bottom">
        <div class="collapse-btn" @click="collapsed = !collapsed">
          <Icon name="panelLeft" :size="15" color="#8a919f" :class="{ flip: collapsed }" />
          <span class="collapse-txt">收起</span>
        </div>
        <div class="side-user">
          <div class="user-avatar">杭</div>
          <div class="user-meta">
            <div class="user-name">{{ orgName }}</div>
            <div class="user-role">管理员</div>
          </div>
        </div>
      </div>
    </aside>

    <div class="app-main">
      <header v-if="!route.meta.flush" class="app-top">
        <span class="top-icon" title="帮助中心" @click="router.push('/help-center')"><Icon name="help" :size="17" /></span>
        <span class="top-icon bell" title="通知"><Icon name="bell" :size="17" /><i class="badge">5</i></span>
      </header>
      <div class="app-body" :class="{ flush: route.meta.flush }">
        <router-view />
      </div>

      <div v-if="!route.meta.flush" class="assistant-fab" title="智能助手">
        <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
          <path d="M8 27c0 7.2 6.7 12.6 14.2 12.6 2.3 0 4.5-.5 6.4-1.5" stroke="#8b7cf6" stroke-width="3" fill="none" stroke-linecap="round" />
          <circle cx="22" cy="18" r="14.5" fill="#fff" />
          <circle cx="22" cy="7.4" r="2.3" fill="#4dabf7" />
          <path d="M22 9.7v3.1" stroke="#4dabf7" stroke-width="1.7" stroke-linecap="round" />
          <rect x="11.4" y="12.6" width="21.2" height="17" rx="5.4" fill="#f4f8ff" stroke="#4dabf7" stroke-width="1.7" />
          <rect x="14.4" y="15.8" width="15.2" height="8.6" rx="3.6" fill="#16305c" />
          <circle cx="18.4" cy="19.8" r="1.55" fill="#5ce1e6" />
          <circle cx="25.6" cy="19.8" r="1.55" fill="#5ce1e6" />
          <path d="M18.8 22.4c1.6 1.1 4 1.1 5.6 0" stroke="#5ce1e6" stroke-width="1.2" fill="none" stroke-linecap="round" />
          <rect x="17.2" y="26.2" width="9.6" height="5.6" rx="2.2" fill="#fff" stroke="#bcd4ff" stroke-width="1.3" />
          <rect x="20.4" y="28" width="3.2" height="3.2" rx=".9" fill="#4dabf7" />
          <path d="M33 17.4l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" fill="#74c0fc" />
          <circle cx="11.8" cy="13.6" r="1.5" fill="#d0bfff" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-icon.bell { position: relative; }
.top-icon .badge {
  position: absolute; top: -4px; right: -5px; min-width: 15px; height: 15px; padding: 0 4px;
  border-radius: 8px; background: #ef4444; color: #fff; font-size: 10px; font-style: normal;
  line-height: 15px; text-align: center;
}
.proj-banner {
  margin: 10px 12px; padding: 10px 12px; border-radius: 8px;
  background: rgba(59, 130, 246, .1); border: 1px solid rgba(59, 130, 246, .2);
}
.proj-row { display: flex; align-items: center; gap: 8px; }
.proj-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #3b82f6; }
.proj-name {
  min-width: 0; flex: 1; font-size: 14px; font-weight: 600; color: #3b82f6; line-height: 20px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proj-type {
  flex: 0 0 auto; display: inline-flex; align-items: center; height: 16px; padding: 2px 4px; border-radius: 4px;
  font-size: 10px; line-height: 1; font-weight: 500; color: #7c3aed;
  background: rgba(139, 92, 246, .1); border: 1px solid rgba(139, 92, 246, .2);
}
.proj-swap {
  width: 24px; height: 24px; flex: 0 0 24px; display: grid; place-items: center;
  border: none; background: transparent; border-radius: 4.8px; cursor: pointer;
}
.proj-swap:hover { background: rgba(59, 130, 246, .12); }
.proj-back {
  width: 100%; margin-top: 8px; padding: 4px 8px; display: flex; align-items: center; gap: 6px;
  border: none; background: transparent; border-radius: 4.8px; cursor: pointer;
  font-size: 12px; color: #6b7280; font-family: inherit; text-align: left;
}
.proj-back:hover { background: rgba(255, 255, 255, .6); color: #111827; }

.ai-fab {
  position: fixed; right: 0; top: 36%; width: 32px; height: 32px; border-radius: 50%;
  background: #f78fb3; display: grid; place-items: center; cursor: pointer;
  box-shadow: 0 2px 8px rgba(247, 143, 179, .45); z-index: 30;
}
.assistant-fab {
  position: fixed; right: 14px; bottom: 12px; width: 44px; height: 44px;
  display: grid; place-items: center; cursor: pointer;
  filter: drop-shadow(0 4px 8px rgba(108, 92, 231, .18));
}
.app-side.collapsed .proj-banner { display: none; }
</style>
