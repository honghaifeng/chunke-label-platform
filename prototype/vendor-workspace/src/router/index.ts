import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import LoginView from '@/views/LoginView.vue'
import OrgSelectView from '@/views/OrgSelectView.vue'
import ProjectsView from '@/views/ProjectsView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'
import AllocateView from '@/views/AllocateView.vue'
import LongAudioWorkbench from '@/views/LongAudioWorkbench.vue'
import AnnotateEditor from '@/views/AnnotateEditor.vue'
import ReviewWorkbench from '@/views/ReviewWorkbench.vue'
import ReviewEditor from '@/views/ReviewEditor.vue'
import ReworkWorkbench from '@/views/ReworkWorkbench.vue'
import ReworkManagement from '@/views/ReworkManagement.vue'
import PermissionsView from '@/views/PermissionsView.vue'
import RecordingView from '@/views/RecordingView.vue'
import FolderUploadView from '@/views/FolderUploadView.vue'
import AcceptanceView from '@/views/AcceptanceView.vue'
import ExamView from '@/views/ExamView.vue'
import OrgSettingsView from '@/views/OrgSettingsView.vue'
import MemberCenterView from '@/views/MemberCenterView.vue'
import SubOrgsView from '@/views/SubOrgsView.vue'
import MyMistakesView from '@/views/MyMistakesView.vue'
import MistakeSquareView from '@/views/MistakeSquareView.vue'
import MyStatsView from '@/views/MyStatsView.vue'
import QualityDashboardView from '@/views/QualityDashboardView.vue'
import OrgWorkStatsView from '@/views/OrgWorkStatsView.vue'
import SuspendedTasksView from '@/views/SuspendedTasksView.vue'
import ProjectConfigView from '@/views/ProjectConfigView.vue'
import QuickToolsView from '@/views/QuickToolsView.vue'
import MyConfigView from '@/views/MyConfigView.vue'
import ProjectStatsView from '@/views/ProjectStatsView.vue'
import MemberConfigsView from '@/views/MemberConfigsView.vue'
import DepartmentsView from '@/views/DepartmentsView.vue'
import InvitationsView from '@/views/InvitationsView.vue'
import ApprovalsView from '@/views/ApprovalsView.vue'
import PartnersView from '@/views/PartnersView.vue'
import PartnerRequestsView from '@/views/PartnerRequestsView.vue'
import ScriptReviewView from '@/views/ScriptReviewView.vue'
import HelpCenterView from '@/views/HelpCenterView.vue'
import AnnotationTasksView from '@/views/AnnotationTasksView.vue'
import WorkDetailsView from '@/views/WorkDetailsView.vue'
import MyAnnotationsView from '@/views/MyAnnotationsView.vue'
import ProjectMembersView from '@/views/ProjectMembersView.vue'
import RecordingsView from '@/views/RecordingsView.vue'
import AuditWorkbenchView from '@/views/AuditWorkbenchView.vue'
import AiValidationsView from '@/views/AiValidationsView.vue'
import MistakeManagementView from '@/views/MistakeManagementView.vue'
import ProjectMyMistakesView from '@/views/ProjectMyMistakesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import { useSession } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { title: '登录' } },
    { path: '/orgs', component: OrgSelectView, meta: { title: '选择组织', requiresAuth: true } },
    { path: '/help-center', component: HelpCenterView, meta: { title: '帮助中心', requiresAuth: true, flush: true } },
    { path: '/', redirect: '/vendor/projects' },
    {
      path: '/vendor',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: 'projects' },
        { path: 'projects', component: ProjectsView, meta: { title: '项目列表' } },

        { path: 'mistake-square', component: MistakeSquareView, meta: { title: '错题广场' } },
        { path: 'my-mistakes', component: MyMistakesView, meta: { title: '我的错题集' } },
        { path: 'suspended-tasks', component: SuspendedTasksView, meta: { title: '挂起任务管理' } },
        { path: 'project-config', component: ProjectConfigView, meta: { title: '项目配置' } },
        { path: 'annotation-rules', component: QuickToolsView, meta: { title: '我的快捷工具' } },
        { path: 'tools', redirect: 'annotation-rules' },
        { path: 'stats', component: ProjectStatsView, meta: { title: '项目统计' } },
        { path: 'my-stats', component: MyStatsView, meta: { title: '我的统计' } },
        { path: 'org-stats', component: OrgWorkStatsView, meta: { title: '团队工作统计' } },
        { path: 'quality-dashboard', component: QualityDashboardView, meta: { title: '质检看板' } },
        { path: 'user-configs', component: MemberConfigsView, meta: { title: '用户配置管理' } },
        { path: 'my-config', component: MyConfigView, meta: { title: '我的配置' } },
        { path: 'my-settings', redirect: 'my-config' },
        { path: 'script-review', component: ScriptReviewView, meta: { title: '台本评审' } },
        { path: 'guide', redirect: '/help-center' },
        { path: 'exam/gate', component: ExamView, meta: { title: '入职考试' } },

        { path: 'org/settings', component: OrgSettingsView, meta: { title: '组织设置' } },
        { path: 'org/member-center', component: MemberCenterView, meta: { title: '成员管理' } },
        { path: 'org/sub-orgs', component: SubOrgsView, meta: { title: '子组织管理' } },
        { path: 'org/departments', component: DepartmentsView, meta: { title: '部门管理' } },
        { path: 'org/invitations', component: InvitationsView, meta: { title: '邀请成员' } },
        { path: 'org/approvals', component: ApprovalsView, meta: { title: '审批管理' } },
        { path: 'org/permissions', component: PermissionsView, meta: { title: '权限矩阵' } },
        { path: 'org/partnerships', component: PartnersView, meta: { title: '服务商列表' } },
        { path: 'org/partnerships/requests', component: PartnerRequestsView, meta: { title: '合作申请' } },

        { path: 'project/:pid', component: ProjectDetailView, meta: { title: '项目详情' } },
        { path: 'projects/:pid/allocate', component: AllocateView, meta: { title: '任务分配' } },
        { path: 'project/:pid/allocate', component: AllocateView, meta: { title: '任务分配' } },
        { path: 'project/:pid/my-stats', component: MyStatsView, meta: { title: '我的统计' } },
        { path: 'project/:pid/long-audio', component: LongAudioWorkbench, meta: { title: '长音频标注' } },
        {
          path: 'project/:pid/long-audio/annotate/:tid',
          component: AnnotateEditor,
          meta: { title: '标注编辑器', flush: true }
        },
        { path: 'project/:pid/long-audio-review', component: ReviewWorkbench, meta: { title: '质检工作台' } },
        {
          path: 'project/:pid/long-audio-review/:tid',
          component: ReviewEditor,
          meta: { title: '质检编辑器', flush: true }
        },
        { path: 'project/:pid/rework', component: ReworkWorkbench, meta: { title: '返修工作台' } },
        { path: 'project/:pid/rework-management', component: ReworkManagement, meta: { title: '返修管理' } },
        { path: 'project/:pid/long-audio-tasks', component: AnnotationTasksView, meta: { title: '长音频标注任务' } },
        { path: 'project/:pid/work-details', component: WorkDetailsView, meta: { title: '标注和质检明细' } },
        { path: 'project/:pid/long-audio-work-details', component: WorkDetailsView, meta: { title: '长音频标注和质检明细' } },
        { path: 'project/:pid/my-annotations', component: MyAnnotationsView, meta: { title: '我的标注' } },
        { path: 'project/:pid/recordings', component: RecordingsView, meta: { title: '标注数据管理' } },
        { path: 'project/:pid/recordings/record', component: RecordingView, meta: { title: '页面录音' } },
        { path: 'project/:pid/recordings/folder-upload', component: FolderUploadView, meta: { title: '上传文件夹' } },
        { path: 'project/:pid/suspended-tasks', component: SuspendedTasksView, meta: { title: '挂起任务' } },
        { path: 'project/:pid/audit', component: AuditWorkbenchView, meta: { title: '审核工作台' } },
        { path: 'project/:pid/validations', component: AiValidationsView, meta: { title: 'AI 质检结果' } },
        { path: 'project/:pid/mistake-square', component: MistakeSquareView, meta: { title: '错题广场' } },
        { path: 'project/:pid/mistake-management', component: MistakeManagementView, meta: { title: '错题管理' } },
        { path: 'project/:pid/my-mistakes', component: ProjectMyMistakesView, meta: { title: '我的错题集' } },
        { path: 'project/:pid/project-config', component: ProjectConfigView, meta: { title: '项目配置' } },
        { path: 'project/:pid/acceptance', component: AcceptanceView, meta: { title: '交付工作台' } },
        { path: 'project/:pid/acceptance/batches', component: AcceptanceView, meta: { title: '交付批次管理' } },
        { path: 'project/:pid/acceptance/nodes', component: AcceptanceView, meta: { title: '交付节点管理' } },
        { path: 'project/:pid/members', component: ProjectMembersView, meta: { title: '成员管理' } },
        { path: 'project/:pid/stats', component: ProjectStatsView, meta: { title: '项目统计' } }
      ]
    },
    { path: '/:pathMatch(.*)*', component: NotFoundView }
  ]
})

router.beforeEach((to) => {
  const session = useSession()
  if (to.meta.requiresAuth && !session.loggedIn) return '/login'
  if (to.path === '/login' && session.loggedIn) return '/orgs'
  if (session.loggedIn && !session.orgCode && to.path !== '/login' && to.path !== '/orgs') return '/orgs'
  return true
})

export default router
