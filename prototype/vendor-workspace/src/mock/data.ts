import type {
  Batch, Member, Mistake, Org, PermissionRow, Project, QualityRecord, ReworkItem, Segment, Task
} from './types'

/* 说明：本文件全部为演示数据，仅用于原型演示，与真实业务无关。 */

export const orgs: Org[] = [
  { code: 'ORG24f966c4', name: '杭州春客', role: '组织管理员', vendor: true, members: 27 },
  { code: 'ORGa7afda9d', name: '杭州春客-安全屋项目', role: '组织管理员', vendor: true, members: 9 }
]

export const projects: Project[] = [
  {
    id: 435004,
    code: 'PRJ-435004',
    name: '【集团会议试标】10-15分钟/区分说话人',
    type: '长音频拉框',
    lang: '普通话',
    status: '进行中',
    targetHours: 2,
    allocatedHours: 0,
    planHours: 2,
    planAssigned: 0,
    createdAt: '2026-10-28',
    owner: '陈可',
    subOrgs: [],
    counts: { total: 5, pending: 0, doing: 0, draft: 0, done: 0 }
  },
  {
    id: 434004,
    code: 'PRJ-434004',
    name: '【集团会议试标】5-10分钟/区分说话人',
    type: '长音频拉框',
    lang: '普通话',
    status: '进行中',
    targetHours: 2,
    allocatedHours: 0,
    planHours: 2,
    planAssigned: 0,
    createdAt: '2026-11-05',
    owner: '陈可',
    subOrgs: [],
    counts: { total: 21, pending: 6, doing: 8, draft: 2, done: 5 }
  },
  {
    id: 434005,
    code: 'PRJ-434005',
    name: '【集团会议试标】5分钟以下/区分说话人',
    type: '长音频拉框',
    lang: '普通话',
    status: '进行中',
    targetHours: 2,
    allocatedHours: 0,
    planHours: 2,
    planAssigned: 0,
    createdAt: '2026-09-12',
    owner: '李萌',
    subOrgs: [],
    counts: { total: 18, pending: 0, doing: 0, draft: 0, done: 18 }
  }
]

const pool = [
  '您好，请问有什么可以帮您？',
  '我昨天买的那件外套到现在还没有发货。',
  '麻烦您提供一下订单号，我帮您查询物流。',
  '订单号是 2026111800231，麻烦快一点。',
  '已经帮您催单了，预计今天下午会揽收。',
  '我收到货以后发现尺码不太合适，想换大一码。',
  '换货需要您先在订单页面提交换货申请。',
  '提交以后大概多久能处理完成呢？',
  '一般情况下四十八小时内会审核通过。',
  '好的，那我先提交试试看。',
  '如果超过时间没有处理，您可以再联系我们。',
  '还有一个问题，运费是谁承担呢？',
  '尺码问题属于个人原因，运费需要您自行承担。',
  '但是你们页面标注的是支持七天无理由换货。',
  '是的，换货本身免费，只收取寄回的运费。',
  '明白了，那我考虑一下再决定。',
  '我的优惠券好像没有办法使用，能帮我看一下吗？',
  '请您提供一下账号绑定的手机号后四位。',
  '尾号是 8823，用的是新注册的账号。',
  '这张券限定新客首单使用，您的订单可能不符合条件。',
  '可是我确实是第一次下单啊。',
  '我这边看到您之前有一笔已取消的订单。',
  '那笔订单取消了应该不算吧？',
  '系统规则是按历史下单记录来判断的。',
  '这样有点不合理，能不能特殊处理一下？',
  '我帮您申请一张同等金额的补偿券，可以吗？',
  '可以，那就麻烦你了。',
  '补偿券会在两小时内发放到您的账户。',
  '好的，我一会儿再看一下。',
  '请问还有其他可以帮您的吗？',
  '暂时没有了，谢谢你。',
  '感谢您的来电，祝您生活愉快。',
  '我想咨询一下这个产品的保修期限。',
  '整机保修一年，主要部件保修两年。',
  '保修需要提供购买凭证吗？',
  '需要提供订单截图或者发票都可以。',
  '那我直接拍照发给客服就行吧。',
  '可以的，收到后我们会为您登记保修信息。',
  '请问上门维修需要额外收费吗？',
  '保修期内非人为损坏是免费上门的。',
  '那太好了，我明天就联系你们。'
]

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSegments(
  taskId: number,
  count: number,
  duration: number,
  draftCount: number,
  status: 'pending' | 'draft' | 'passed'
): Segment[] {
  const rand = mulberry32(taskId)
  const list: Segment[] = []
  let t = 1.2
  for (let i = 0; i < count; i += 1) {
    const len = 1.6 + rand() * 3.2
    const start = Math.min(duration - 0.6, t)
    const end = Math.min(duration, start + len)
    const speaker = `S${1 + Math.floor(rand() * 4)}`
    let segStatus: Segment['status'] = status === 'passed' ? 'passed' : status
    if (i < draftCount) segStatus = 'draft'
    list.push({
      id: taskId * 1000 + i + 1,
      idx: i + 1,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      speaker,
      status: segStatus,
      text: status === 'passed' ? pool[(i + taskId) % pool.length] : i < draftCount ? '' : '',
      easy: rand() > 0.28
    })
    t = end + 0.5 + rand() * 1.6
  }
  return list
}

export const tasks: Task[] = [
  {
    id: 11074116, projectId: 435004, duration: 731, status: '待质检', assignee: '泽漆', qcNode: '杭州春客',
    updatedAt: '2026年11月18日 11:45', rework: true,
    segments: makeSegments(11074116, 90, 731, 0, 'passed')
  },
  {
    id: 11676028, projectId: 435004, duration: 830, status: '待领取', assignee: 'denice', qcNode: '',
    updatedAt: '2026年11月12日 23:11',
    segments: makeSegments(11676028, 121, 830, 0, 'pending')
  },
  {
    id: 11676027, projectId: 435004, duration: 716, status: '待领取', assignee: 'denice', qcNode: '',
    updatedAt: '2026年11月12日 23:11',
    segments: makeSegments(11676027, 104, 716, 0, 'pending')
  },
  {
    id: 11676026, projectId: 435004, duration: 692, status: '待领取', assignee: 'denice', qcNode: '',
    updatedAt: '2026年11月12日 23:11',
    segments: makeSegments(11676026, 16, 692, 0, 'pending')
  },
  {
    id: 11676025, projectId: 435004, duration: 839, status: '待领取', assignee: 'denice', qcNode: '',
    updatedAt: '2026年11月12日 23:10',
    segments: makeSegments(11676025, 93, 839, 0, 'pending')
  }
]

export const reworkItems: ReworkItem[] = []

export const batches: Batch[] = [
  { id: 'B20261120001', projectId: 435004, name: '第一批次 · 客服语音 200 小时', tasks: 45, hours: 200, status: '验收中', acceptor: '平台验收组', createdAt: '2026-11-20' },
  { id: 'B20261122002', projectId: 435004, name: '第二批次 · 客服语音 180 小时', tasks: 40, hours: 180, status: '待分配验收员', acceptor: '', createdAt: '2026-11-22' },
  { id: 'B20261124003', projectId: 435004, name: '第三批次 · 客服语音 160 小时', tasks: 36, hours: 160, status: '待提交', acceptor: '', createdAt: '2026-11-24' },
  { id: 'B20261118004', projectId: 435004, name: '补充批次 · 售后场景 60 小时', tasks: 14, hours: 60, status: '通过', acceptor: '张验收', createdAt: '2026-11-18' },
  { id: 'B20261116005', projectId: 435004, name: '试标批次 · 30 小时', tasks: 8, hours: 30, status: '驳回', acceptor: '平台验收组', createdAt: '2026-11-16' }
]

export const nodes = [
  { id: 'N20261120001', batch: 'B20261120001', name: '节点 1 · 售后咨询', tasks: 18, status: '验收中', acceptor: '平台验收组', updatedAt: '2026-11-24 16:02' },
  { id: 'N20261120002', batch: 'B20261120001', name: '节点 2 · 物流查询', tasks: 15, status: '平台验收通过', acceptor: '平台验收组', updatedAt: '2026-11-23 11:20' },
  { id: 'N20261120003', batch: 'B20261120001', name: '节点 3 · 退换货', tasks: 12, status: '平台驳回', acceptor: '平台验收组', updatedAt: '2026-11-22 17:45' },
  { id: 'N20261122004', batch: 'B20261122002', name: '节点 4 · 优惠券', tasks: 20, status: '待分配验收员', acceptor: '', updatedAt: '2026-11-22 10:30' },
  { id: 'N20261122005', batch: 'B20261122002', name: '节点 5 · 产品保修', tasks: 20, status: '待提交', acceptor: '', updatedAt: '2026-11-22 10:31' },
  { id: 'N20261124006', batch: 'B20261124003', name: '节点 6 · 综合场景', tasks: 36, status: '申诉中', acceptor: '张验收', updatedAt: '2026-11-24 19:10' }
]

const memberNames = [
  '党静茹', '李梦婷', '刘杜娟', '白羽', '叶妍', '岳盼盼', '孙淑娟', '刘宇慧', '姬萌萌', '任展慧',
  '付英姿', '买金鸽', '王亚林', '张磊', '陈可', '李萌', '王倩', '赵一鸣', '孙晓', '李思',
  '周航', '吴桐', '郑楠', '冯越', '许诺', '蒋楠', '沈亦'
]

const memberIds = [
  2049002, 2049001, 2048003, 2048002, 2048001, 2047001, 2046002, 2046001, 2045001, 2044003,
  2044002, 2044001, 2043005, 2043004, 2043003, 2043002, 2043001, 2042002, 2042001, 2041004,
  2041003, 2041002, 2041001, 2040002, 2040001, 2039001, 2039002
]

export const members: Member[] = memberNames.map((name, i) => ({
  id: memberIds[i],
  name,
  account: `chunke_${String(i + 1).padStart(3, '0')}`,
  phone: `+86 13${i % 9}****${String(2200 + i * 37).slice(-4)}`,
  role: i === 0 ? '组织管理员' : i < 4 ? '项目经理' : i % 7 === 0 ? '质检员' : '标注员',
  orgRole: '普通成员',
  dept: ['语音标注部', '质量管理部', '项目管理部', '数据运营部'][i % 4],
  subOrg: i % 3 === 0 ? '语音标注一组' : i % 3 === 1 ? '语音标注二组' : '安全屋小组',
  status: '活跃',
  joinedAt: `2026-0${1 + (i % 9)}-${String(2 + (i % 26)).padStart(2, '0')}`,
  tasks: 40 + ((i * 37) % 260),
  recording: '暂无录音累计'
}))

export const mistakes: Mistake[] = Array.from({ length: 12 }).map((_, i) => ({
  id: 9001 + i,
  taskId: 11074000 + i * 7,
  annotator: memberNames[(i * 3) % memberNames.length],
  type: ['边界不准', '角色标错', '文本漏字', '未处理重叠', '静音段未拉框'][i % 5],
  desc: [
    '拉框起点比人声提前约 0.6 秒，导致包含明显底噪',
    '同一段对话中把客户误标成客服',
    '转写文本漏掉语气词，需完整保留',
    '双人同时说话区间只标注了一个说话人',
    '超过 2 秒的静音段未拉框'
  ][i % 5],
  createdAt: `2026-11-${String(10 + i).padStart(2, '0')} 1${i % 9}:2${i % 6}`,
  status: i % 3 === 0 ? '待学习' : '已学习'
}))

export const permissions: PermissionRow[] = [
  { group: '组织', code: 'settings_edit', label: '编辑组织设置', roles: { 组织管理员: true } },
  { group: '组织', code: 'settings_view', label: '查看组织设置', roles: { 组织管理员: true } },
  { group: '组织', code: 'suborg:create', label: '创建子组织', roles: { 组织管理员: true } },
  { group: '组织', code: 'suborg:manage', label: '管理子组织', roles: { 组织管理员: true } },
  { group: '成员', code: 'member:invite', label: '邀请成员', roles: { 组织管理员: true } },
  { group: '成员', code: 'member:remove', label: '移除成员', roles: { 组织管理员: true } },
  { group: '成员', code: 'member:disable', label: '禁用成员', roles: { 组织管理员: true } },
  { group: '成员', code: 'member:enable', label: '启用成员', roles: { 组织管理员: true } },
  { group: '成员', code: 'role_assign', label: '分配角色', roles: { 组织管理员: true } },
  { group: '成员', code: 'member:list', label: '查看成员列表', roles: { 组织管理员: true, 项目经理: true } },
  { group: '部门', code: 'dept:create', label: '创建部门', roles: { 组织管理员: true } },
  { group: '部门', code: 'dept:edit', label: '编辑部门', roles: { 组织管理员: true } },
  { group: '部门', code: 'dept:delete', label: '删除部门', roles: { 组织管理员: true } },
  { group: '部门', code: 'member_move', label: '移动成员', roles: { 组织管理员: true } },
  { group: '项目', code: 'project:create', label: '创建项目', roles: { 组织管理员: true, 项目经理: true } },
  { group: '项目', code: 'project:edit', label: '编辑项目', roles: { 组织管理员: true, 项目经理: true } },
  { group: '项目', code: 'project:delete', label: '删除项目', roles: { 组织管理员: true } },
  { group: '项目', code: 'project:view', label: '查看项目', roles: { 组织管理员: true, 项目经理: true, 标注员: true, 质检员: true, 验收员: true } },
  { group: '项目', code: 'project:share', label: '分享项目', roles: { 组织管理员: true, 项目经理: true } },
  { group: '任务', code: 'task:assign', label: '分配任务', roles: { 组织管理员: true, 项目经理: true } },
  { group: '任务', code: 'task:export', label: '导出任务', roles: { 组织管理员: true, 项目经理: true, 验收员: true } },
  { group: '任务', code: 'task:view', label: '查看任务', roles: { 组织管理员: true, 项目经理: true, 标注员: true, 质检员: true, 验收员: true } },
  { group: '标注', code: 'annotation:submit', label: '提交标注', roles: { 组织管理员: true, 项目经理: true, 标注员: true } },
  { group: '标注', code: 'annotation:review', label: '质检标注', roles: { 组织管理员: true, 项目经理: true, 质检员: true } },
  { group: '标注', code: 'annotation:accept', label: '验收标注', roles: { 组织管理员: true, 项目经理: true, 验收员: true } },
  { group: 'BPO', code: 'partner_manage', label: '服务商管理', roles: { 组织管理员: true } },
  { group: 'BPO', code: 'task_receive', label: '接收外部任务', roles: { 组织管理员: true } },
  { group: '系统', code: 'audit_view', label: '查看审计日志', roles: { 组织管理员: true } },
  { group: '系统', code: 'audit_export', label: '导出审计日志', roles: { 组织管理员: true } },
  { group: '系统', code: 'integration', label: '集成配置', roles: { 组织管理员: true } },
  { group: '平台', code: 'org_create', label: '创建组织', roles: {} },
  { group: '平台', code: 'org_manage', label: '管理组织', roles: {} },
  { group: '平台', code: 'admin_manage', label: '管理员管理', roles: {} },
  { group: '平台', code: 'platform:config', label: '平台配置', roles: {} }
]

export const roleNames = ['组织管理员', '项目经理', '标注员', '质检员', '验收员']

export const qualityRecords: QualityRecord[] = Array.from({ length: 14 }).map((_, i) => ({
  taskId: 11074100 + i,
  annotator: memberNames[(i * 5) % memberNames.length],
  ai: i % 3 === 0 ? '不通过' : '通过',
  issues: i % 3 === 0 ? 1 + (i % 3) : 0,
  text: pool[(i * 4) % pool.length],
  qcAt: `2026-11-25 0${8 + (i % 2)}:${String(10 + i).padStart(2, '0')}`
}))

export const invalidReasons = [
  '底噪', '没有人说话', '音频内容不全', '声音听不清', '音频经过特殊处理', '直接读本',
  '敏感内容', '无声音', '非目标语种', '数据缺失', '多人说话'
]
