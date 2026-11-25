import { db, fmtDuration, projectById } from '@/mock'

export interface PageColumn {
  key: string
  title: string
  width?: string
  align?: 'left' | 'right' | 'center'
}

export interface PageConfig {
  title: string
  sub?: string
  stats?: { label: string; value: string | number; unit?: string; accent?: boolean }[]
  filters?: ('search' | 'role' | 'status' | 'dept')[]
  buttons?: string[]
  columns?: PageColumn[]
  rows?: Record<string, any>[]
  note?: string
  empty?: { icon: string; text: string; hint: string }
  form?: { label: string; placeholder: string; action: string }[]
}

const members = db.members
const memberRows = members.map((m) => ({
  name: m.name, account: m.account, role: m.role, dept: m.dept,
  subOrg: m.subOrg, status: m.status, joinedAt: m.joinedAt, tasks: m.tasks
}))

const taskRows = db.tasks.map((t) => ({
  id: t.id, duration: fmtDuration(t.duration), frames: t.segments.length,
  annotator: t.assignee || '—', status: t.status, qcNode: t.qcNode,
  project: projectById(t.projectId)?.name || '—'
}))

const detailRows = db.tasks.slice(0, 12).map((t) => {
  const done = t.segments.filter((s) => s.status === 'done').length
  return {
    id: t.id,
    project: projectById(t.projectId)?.name || '—',
    annotator: t.assignee || '—',
    frames: t.segments.length,
    done,
    duration: fmtDuration(t.duration),
    submittedAt: t.submittedAt || '2026-11-24 17:20',
    status: t.status
  }
})

const taskCols: PageColumn[] = [
  { key: 'id', title: '任务号', width: '120px' },
  { key: 'duration', title: '时长', width: '90px' },
  { key: 'frames', title: '转写框', width: '90px' },
  { key: 'annotator', title: '标注员', width: '100px' },
  { key: 'qcNode', title: '质检节点', width: '110px' },
  { key: 'status', title: '状态', width: '100px' }
]

export const pages: Record<string, PageConfig> = {
  'suspended-tasks': {
    title: '挂起任务管理',
    sub: '挂起后任务不计入超时，可在恢复后继续作业',
    stats: [
      { label: '挂起任务', value: 3, unit: '个' },
      { label: '涉及转写框', value: 86, unit: '框' },
      { label: '平均挂起时长', value: '6.5', unit: '小时' },
      { label: '今日恢复', value: 2, unit: '个', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'id', title: '任务号', width: '120px' },
      { key: 'annotator', title: '作业人', width: '100px' },
      { key: 'reason', title: '挂起原因' },
      { key: 'hours', title: '已挂起', width: '110px' },
      { key: 'at', title: '挂起时间', width: '150px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { id: 11677011, annotator: '王倩', reason: '音频存在无法辨认的方言段落', hours: '3.5 小时', at: '2026-11-25 07:10', status: '待质检' },
      { id: 11677013, annotator: '赵一鸣', reason: '等待客户补充背景音说明', hours: '8.2 小时', at: '2026-11-24 22:05', status: '标注中' },
      { id: 11074116, annotator: '孙晓', reason: '质检标准待项目经理确认', hours: '12.0 小时', at: '2026-11-24 18:40', status: '质检中' }
    ],
    note: '挂起操作会保留当前标注内容，恢复后从原位置继续。'
  },
  'project-config': {
    title: '项目配置',
    sub: '长音频拉框 · 无效原因与抽检规则',
    stats: [
      { label: '无效原因', value: 11, unit: '类' },
      { label: '抽检比例', value: '30', unit: '%' },
      { label: '返修次数上限', value: 3, unit: '次' },
      { label: '转写框时长上限', value: 30, unit: '秒' }
    ],
    columns: [
      { key: 'name', title: '配置项' },
      { key: 'value', title: '当前值', width: '260px' },
      { key: 'updatedAt', title: '更新时间', width: '160px' },
      { key: 'operator', title: '操作人', width: '100px' }
    ],
    rows: [
      { name: '无效原因（11 类）', value: '底噪 / 没有人说话 / 音频内容不全 / 声音听不清 / 音频经过特殊处理 / 直接读本 / 敏感内容 / 无声音 / 非目标语种 / 数据缺失 / 多人说话', updatedAt: '2026-11-20 10:22', operator: '陈可' },
      { name: '抽检比例', value: '30%', updatedAt: '2026-11-18 09:05', operator: '陈可' },
      { name: '返修次数上限', value: '3 次（超过触发质量复核）', updatedAt: '2026-11-12 15:40', operator: '李萌' },
      { name: '转写框时长上限', value: '30 秒', updatedAt: '2026-11-10 11:12', operator: '李萌' },
      { name: '重叠说话处理', value: '允许重叠，需在上一位说话人区间补结束边界', updatedAt: '2026-11-08 14:30', operator: '陈可' }
    ],
    note: '无效原因在质检拒绝与整体打回时作为下拉选项使用。'
  },
  'annotation-rules': {
    title: '标注规则',
    sub: '组织级通用规则模板，可在项目内覆盖',
    columns: [
      { key: 'name', title: '规则名称' },
      { key: 'scope', title: '适用范围', width: '160px' },
      { key: 'version', title: '版本', width: '90px' },
      { key: 'updatedAt', title: '更新时间', width: '160px' },
      { key: 'operator', title: '维护人', width: '100px' }
    ],
    rows: [
      { name: '长音频拉框通用规范', scope: '长音频拉框', version: 'v2.3', updatedAt: '2026-11-19 16:20', operator: '李萌' },
      { name: '双人重叠说话标注细则', scope: '长音频拉框', version: 'v1.4', updatedAt: '2026-11-15 10:00', operator: '陈可' },
      { name: '方言词转写约定', scope: '全项目', version: 'v1.1', updatedAt: '2026-11-06 09:30', operator: '李萌' },
      { name: '静音段与底噪处理规则', scope: '长音频拉框', version: 'v1.0', updatedAt: '2026-10-30 14:45', operator: '陈可' }
    ],
    note: '规则更新后，进行中的任务在下次打开时生效。'
  },
  'stats': {
    title: '项目统计',
    sub: '按项目汇总生产与质检数据',
    stats: [
      { label: '累计标注时长', value: 860, unit: '小时' },
      { label: '完成任务', value: 13, unit: '个' },
      { label: '一次通过率', value: '86.4', unit: '%' },
      { label: '平均返修次数', value: '1.2', unit: '次', accent: true }
    ],
    columns: [
      { key: 'name', title: '项目' },
      { key: 'type', title: '类型', width: '120px' },
      { key: 'hours', title: '已标注时长', width: '120px' },
      { key: 'tasks', title: '任务数', width: '90px' },
      { key: 'pass', title: '一次通过率', width: '110px' },
      { key: 'rework', title: '返修次数', width: '100px' }
    ],
    rows: [
      { name: '长音频拉框-电商客服语音（演示）', type: '长音频拉框', hours: 860, tasks: 45, pass: '86.4%', rework: 8 },
      { name: '安全屋-智能硬件唤醒词（演示）', type: '长音频拉框', hours: 210, tasks: 21, pass: '91.2%', rework: 3 },
      { name: '方言语音采集-西南官话（演示）', type: '长音频拉框', hours: 300, tasks: 18, pass: '88.0%', rework: 5 }
    ]
  },
  'my-stats': {
    title: '我的统计',
    sub: '每日实时 / 历史统计 / 标注统计 / 质检统计',
    stats: [
      { label: '今日标注', value: 6, unit: '个任务' },
      { label: '今日转写框', value: 128, unit: '框' },
      { label: '今日质检', value: 9, unit: '个任务' },
      { label: '一次通过率', value: '92.5', unit: '%', accent: true }
    ],
    columns: [
      { key: 'date', title: '日期', width: '130px' },
      { key: 'annotate', title: '标注任务', width: '110px' },
      { key: 'frames', title: '转写框', width: '100px' },
      { key: 'review', title: '质检任务', width: '110px' },
      { key: 'pass', title: '通过率', width: '100px' },
      { key: 'rework', title: '返修', width: '90px' }
    ],
    rows: [
      { date: '2026-11-25', annotate: 6, frames: 128, review: 9, pass: '92.5%', rework: 1 },
      { date: '2026-11-24', annotate: 11, frames: 246, review: 14, pass: '89.3%', rework: 2 },
      { date: '2026-11-23', annotate: 9, frames: 201, review: 12, pass: '90.1%', rework: 1 },
      { date: '2026-11-22', annotate: 8, frames: 176, review: 10, pass: '87.6%', rework: 3 },
      { date: '2026-11-21', annotate: 10, frames: 220, review: 11, pass: '91.8%', rework: 0 }
    ]
  },
  'quality-dashboard': {
    title: '质检看板',
    sub: '流转漏斗与四项合格率',
    stats: [
      { label: '待质检', value: 5, unit: '个' },
      { label: '一次通过率', value: '86.4', unit: '%' },
      { label: '返修率', value: '13.6', unit: '%' },
      { label: '平均质检时长', value: '11', unit: '分钟', accent: true }
    ],
    columns: [
      { key: 'stage', title: '流转阶段' },
      { key: 'count', title: '任务数', width: '120px' },
      { key: 'rate', title: '占比', width: '120px' },
      { key: 'trend', title: '环比', width: '120px' }
    ],
    rows: [
      { stage: '待领取', count: 4, rate: '8.9%', trend: '+1' },
      { stage: '标注中', count: 23, rate: '51.1%', trend: '-2' },
      { stage: '待质检', count: 5, rate: '11.1%', trend: '+2' },
      { stage: '质检通过', count: 9, rate: '20.0%', trend: '0' },
      { stage: '返修/退回', count: 4, rate: '8.9%', trend: '-1' }
    ],
    note: '四项合格率：边界 91%、说话人 88%、文本 85%、完整性 82%（演示数据）。'
  },
  'long-audio-tasks': {
    title: '长音频标注任务',
    sub: '项目内全部标注任务',
    stats: [
      { label: '任务总数', value: 45, unit: '个' },
      { label: '我标注中', value: 6, unit: '个' },
      { label: '待领取', value: 2, unit: '个' },
      { label: '已提交', value: 13, unit: '个', accent: true }
    ],
    filters: ['search', 'status'],
    columns: taskCols,
    rows: taskRows
  },
  'work-details': {
    title: '标注和质检明细',
    sub: '任务级标注与质检结果明细',
    stats: [
      { label: '明细记录', value: 12, unit: '条' },
      { label: '已标注框', value: 268, unit: '框' },
      { label: '质检通过', value: 241, unit: '框' },
      { label: '拒绝框', value: 27, unit: '框', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'id', title: '任务号', width: '120px' },
      { key: 'annotator', title: '标注员', width: '100px' },
      { key: 'frames', title: '转写框', width: '90px' },
      { key: 'done', title: '已标注', width: '90px' },
      { key: 'duration', title: '时长', width: '90px' },
      { key: 'submittedAt', title: '提交时间', width: '160px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: detailRows
  },
  'my-annotations': {
    title: '我的标注',
    sub: '当前账号提交的标注记录',
    stats: [
      { label: '累计提交', value: 132, unit: '个' },
      { label: '本月提交', value: 28, unit: '个' },
      { label: '被拒任务', value: 3, unit: '个' },
      { label: '平均一次通过率', value: '92.5', unit: '%', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'id', title: '任务号', width: '120px' },
      { key: 'project', title: '项目', width: '260px' },
      { key: 'frames', title: '转写框', width: '90px' },
      { key: 'submittedAt', title: '提交时间', width: '160px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: detailRows.slice(0, 8)
  },
  'recordings': {
    title: '标注数据管理',
    sub: '音频数据导入、页面录音与文件夹上传',
    stats: [
      { label: '音频文件', value: 128, unit: '个' },
      { label: '总时长', value: 312, unit: '小时' },
      { label: '已转任务', value: 45, unit: '个' },
      { label: '待分配', value: 12, unit: '个', accent: true }
    ],
    filters: ['search'],
    columns: [
      { key: 'name', title: '文件名' },
      { key: 'duration', title: '时长', width: '100px' },
      { key: 'size', title: '大小', width: '100px' },
      { key: 'uploadedAt', title: '上传时间', width: '160px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { name: 'kefu_20261120_001.wav', duration: '12:04', size: '86.2 MB', uploadedAt: '2026-11-20 10:12', status: '已接收' },
      { name: 'kefu_20261120_002.wav', duration: '09:48', size: '71.4 MB', uploadedAt: '2026-11-20 10:14', status: '已接收' },
      { name: 'kefu_20261121_003.wav', duration: '15:22', size: '104.8 MB', uploadedAt: '2026-11-21 09:02', status: '已接收' },
      { name: 'kefu_20261122_004.wav', duration: '11:36', size: '82.1 MB', uploadedAt: '2026-11-22 14:30', status: '待接收' },
      { name: 'kefu_20261124_005.wav', duration: '13:18', size: '95.6 MB', uploadedAt: '2026-11-24 16:45', status: '待接收' }
    ]
  },
  'audit': {
    title: '审核工作台',
    sub: '平台验收与模型验收结果',
    stats: [
      { label: '待提交', value: 2, unit: '批' },
      { label: '验收中', value: 1, unit: '批' },
      { label: '平台验收通过', value: 1, unit: '批' },
      { label: '退回返修', value: 1, unit: '批', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'batch', title: '交付批次', width: '160px' },
      { key: 'tasks', title: '任务数', width: '90px' },
      { key: 'platform', title: '平台验收', width: '130px' },
      { key: 'model', title: '模型验收', width: '130px' },
      { key: 'status', title: '状态', width: '130px' }
    ],
    rows: db.batches.map((b, i) => ({
      batch: b.id, tasks: b.tasks,
      platform: i === 0 ? '验收中' : i === 3 ? '平台验收通过' : i === 4 ? '平台验收不通过' : '待提交',
      model: i === 3 ? '模型验收通过' : i === 4 ? '模型验收不通过' : '—',
      status: b.status
    }))
  },
  'validations': {
    title: 'AI 质检结果',
    sub: 'AI 判定 / 问题数 / 标注文本 / 质检时间',
    stats: [
      { label: 'AI 已质检', value: 14, unit: '个' },
      { label: 'AI 判定不通过', value: 5, unit: '个' },
      { label: '问题总数', value: 9, unit: '处' },
      { label: 'AI 命中率', value: '64.3', unit: '%', accent: true }
    ],
    filters: ['search'],
    columns: [
      { key: 'taskId', title: '任务号', width: '120px' },
      { key: 'annotator', title: '标注员', width: '100px' },
      { key: 'ai', title: 'AI 判定', width: '100px' },
      { key: 'issues', title: '问题数', width: '90px' },
      { key: 'text', title: '标注文本' },
      { key: 'qcAt', title: '质检时间', width: '150px' }
    ],
    rows: db.qualityRecords
  },
  'mistake-management': {
    title: '错题管理',
    sub: '按任务汇总错题，支持推送到错题广场',
    stats: [
      { label: '错题总数', value: 12, unit: '条' },
      { label: '待学习', value: 4, unit: '条' },
      { label: '涉及标注员', value: 8, unit: '人' },
      { label: '本月新增', value: 6, unit: '条', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'taskId', title: '任务号', width: '120px' },
      { key: 'annotator', title: '标注员', width: '100px' },
      { key: 'type', title: '错题类型', width: '130px' },
      { key: 'desc', title: '问题描述' },
      { key: 'createdAt', title: '创建时间', width: '150px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: db.mistakes
  },
  'my-mistakes': {
    title: '我的错题集',
    sub: '当前账号的错题与学习状态',
    stats: [
      { label: '我的错题', value: 5, unit: '条' },
      { label: '待学习', value: 2, unit: '条' },
      { label: '已学习', value: 3, unit: '条' },
      { label: '重复出错', value: 1, unit: '条', accent: true }
    ],
    columns: [
      { key: 'taskId', title: '任务号', width: '120px' },
      { key: 'type', title: '错题类型', width: '130px' },
      { key: 'desc', title: '问题描述' },
      { key: 'createdAt', title: '创建时间', width: '150px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: db.mistakes.slice(0, 5)
  },
  'members': {
    title: '成员管理',
    sub: '项目级成员与作业量',
    stats: [
      { label: '项目成员', value: 18, unit: '人' },
      { label: '标注员', value: 12, unit: '人' },
      { label: '质检员', value: 4, unit: '人' },
      { label: '验收员', value: 2, unit: '人', accent: true }
    ],
    filters: ['search', 'role'],
    columns: [
      { key: 'name', title: '成员', width: '110px' },
      { key: 'role', title: '角色', width: '110px' },
      { key: 'subOrg', title: '子组织', width: '140px' },
      { key: 'tasks', title: '任务数', width: '100px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: memberRows.slice(0, 14)
  },
  'org/settings': {
    title: '组织设置',
    sub: '组织基础信息与业务开关',
    columns: [
      { key: 'name', title: '配置项', width: '220px' },
      { key: 'value', title: '当前值' },
      { key: 'updatedAt', title: '更新时间', width: '160px' }
    ],
    rows: [
      { name: '组织名称', value: '杭州春客', updatedAt: '2026-10-28 10:00' },
      { name: '组织编号', value: 'ORG24f966c4', updatedAt: '2026-10-28 10:00' },
      { name: '组织类型', value: '供应商（BPO）', updatedAt: '2026-10-28 10:00' },
      { name: '默认质检抽检比例', value: '30%', updatedAt: '2026-11-12 15:40' },
      { name: '入职考试开关', value: '开启（未通过仅可查看项目列表）', updatedAt: '2026-11-06 09:20' },
      { name: '任务领取上限', value: '每人同时 8 个任务', updatedAt: '2026-11-15 11:05' }
    ],
    note: '修改组织设置需要「settings_edit」权限，仅组织管理员可用。'
  },
  'org/member-center': {
    title: '成员管理',
    sub: '组织成员、角色与部门',
    stats: [
      { label: '成员总数', value: 27, unit: '人' },
      { label: '正常', value: 25, unit: '人' },
      { label: '已禁用', value: 1, unit: '人' },
      { label: '待入职', value: 1, unit: '人', accent: true }
    ],
    filters: ['search', 'role', 'dept'],
    buttons: ['邀请成员', '批量导入'],
    columns: [
      { key: 'name', title: '姓名', width: '100px' },
      { key: 'account', title: '账号', width: '130px' },
      { key: 'role', title: '角色', width: '110px' },
      { key: 'dept', title: '部门', width: '130px' },
      { key: 'subOrg', title: '子组织', width: '130px' },
      { key: 'tasks', title: '累计任务', width: '100px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: memberRows
  },
  'org/sub-orgs': {
    title: '子组织管理',
    sub: '子组织用于任务转分配与独立统计',
    stats: [
      { label: '子组织', value: 3, unit: '个' },
      { label: '覆盖成员', value: 27, unit: '人' },
      { label: '已分配时长', value: 760, unit: '小时' },
      { label: '待接收', value: 1, unit: '个', accent: true }
    ],
    columns: [
      { key: 'name', title: '子组织', width: '160px' },
      { key: 'owner', title: '负责人', width: '110px' },
      { key: 'members', title: '成员数', width: '100px' },
      { key: 'hours', title: '累计分配时长', width: '140px' },
      { key: 'createdAt', title: '创建时间', width: '150px' }
    ],
    rows: [
      { name: '语音标注一组', owner: '王倩', members: 12, hours: 380, createdAt: '2026-10-29 10:00' },
      { name: '语音标注二组', owner: '赵一鸣', members: 8, hours: 260, createdAt: '2026-11-02 09:30' },
      { name: '安全屋小组', owner: '孙晓', members: 7, hours: 120, createdAt: '2026-11-06 14:00' }
    ]
  },
  'org/departments': {
    title: '部门管理',
    sub: '组织架构与成员归属',
    stats: [
      { label: '部门数', value: 4, unit: '个' },
      { label: '成员', value: 27, unit: '人' },
      { label: '未分配部门', value: 0, unit: '人' },
      { label: '本月调整', value: 3, unit: '次', accent: true }
    ],
    columns: [
      { key: 'name', title: '部门', width: '180px' },
      { key: 'leader', title: '负责人', width: '110px' },
      { key: 'members', title: '成员数', width: '100px' },
      { key: 'createdAt', title: '创建时间', width: '150px' }
    ],
    rows: [
      { name: '语音标注部', leader: '李萌', members: 14, createdAt: '2026-10-28 10:10' },
      { name: '质量管理部', leader: '陈可', members: 6, createdAt: '2026-10-28 10:12' },
      { name: '项目管理部', leader: '陈可', members: 4, createdAt: '2026-10-28 10:14' },
      { name: '数据运营部', leader: '周航', members: 3, createdAt: '2026-11-01 09:00' }
    ]
  },
  'org/invitations': {
    title: '邀请成员',
    sub: '通过链接或账号邀请加入组织',
    stats: [
      { label: '有效邀请', value: 2, unit: '个' },
      { label: '已使用', value: 6, unit: '个' },
      { label: '今日邀请', value: 1, unit: '个' },
      { label: '待审批', value: 2, unit: '个', accent: true }
    ],
    columns: [
      { key: 'name', title: '姓名/账号', width: '170px' },
      { key: 'role', title: '预设角色', width: '120px' },
      { key: 'dept', title: '预设部门', width: '140px' },
      { key: 'at', title: '邀请时间', width: '160px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { name: 'zhangye_089', role: '标注员', dept: '语音标注部', at: '2026-11-25 09:10', status: '待入职' },
      { name: 'huaying_090', role: '质检员', dept: '质量管理部', at: '2026-11-24 16:20', status: '已接收' },
      { name: '邀请链接 #2', role: '标注员', dept: '—', at: '2026-11-23 11:00', status: '已接收' }
    ],
    note: '邀请链接有效期 7 天，加入后需完成入职考试。'
  },
  'org/approvals': {
    title: '审批管理',
    sub: '成员加入、角色变更与项目创建审批',
    stats: [
      { label: '待我处理', value: 2, unit: '条' },
      { label: '我发起的', value: 1, unit: '条' },
      { label: '本月已处理', value: 8, unit: '条' },
      { label: '平均处理时长', value: '2.1', unit: '小时', accent: true }
    ],
    columns: [
      { key: 'id', title: '审批编号', width: '140px' },
      { key: 'type', title: '类型', width: '130px' },
      { key: 'applicant', title: '申请人', width: '110px' },
      { key: 'content', title: '内容' },
      { key: 'at', title: '提交时间', width: '160px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { id: 'AP20261125001', type: '成员加入', applicant: '张野', content: '申请加入 语音标注部 · 标注员', at: '2026-11-25 09:12', status: '待审批' },
      { id: 'AP20261124003', type: '角色变更', applicant: '华青', content: '标注员 → 质检员', at: '2026-11-24 16:30', status: '待审批' },
      { id: 'AP20261123007', type: '项目创建', applicant: '陈可', content: '创建项目 安全屋-智能硬件唤醒词', at: '2026-11-23 10:05', status: '已通过' }
    ]
  },
  'org/partnerships': {
    title: '服务商列表',
    sub: '合作中的服务商与任务承接关系',
    columns: [
      { key: 'name', title: '服务商', width: '200px' },
      { key: 'code', title: '编号', width: '150px' },
      { key: 'projects', title: '合作项目', width: '120px' },
      { key: 'since', title: '合作开始', width: '130px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { name: '杭州春客', code: 'ORG24f966c4', projects: 3, since: '2026-10-28', status: '正常' },
      { name: '安徽声谷数据', code: 'ORG88c1a2f3', projects: 1, since: '2026-11-02', status: '正常' },
      { name: '成都语联科技', code: 'ORG7d3e9b21', projects: 2, since: '2026-09-15', status: '已暂停' }
    ]
  },
  'org/partnerships/requests': {
    title: '合作申请',
    sub: '待我处理 / 我的申请',
    stats: [
      { label: '待我处理', value: 1, unit: '条' },
      { label: '我的申请', value: 1, unit: '条' },
      { label: '本月达成', value: 1, unit: '条' },
      { label: '平均响应', value: '1.5', unit: '天', accent: true }
    ],
    columns: [
      { key: 'name', title: '服务商', width: '180px' },
      { key: 'type', title: '合作类型', width: '130px' },
      { key: 'content', title: '说明' },
      { key: 'at', title: '申请时间', width: '150px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { name: '安徽声谷数据', type: '任务承接', content: '申请承接长音频拉框 200 小时', at: '2026-11-24 14:20', status: '待审批' },
      { name: '杭州春客', type: '任务外包', content: '向外包 60 小时售后场景数据', at: '2026-11-20 09:40', status: '已通过' }
    ]
  },
  'user-configs': {
    title: '用户配置管理',
    sub: '按成员配置角色、能力位与项目可见范围',
    filters: ['search', 'role'],
    columns: [
      { key: 'name', title: '成员', width: '110px' },
      { key: 'role', title: '主角色', width: '110px' },
      { key: 'caps', title: '能力位', width: '240px' },
      { key: 'projects', title: '可见项目', width: '100px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: memberRows.slice(0, 10).map((m, i) => ({
      ...m,
      caps: i === 0 ? 'admin / cap_annotator / cap_reviewer' : i < 4 ? 'cap_annotator / cap_reviewer' : 'cap_annotator'
    }))
  },
  'script-review': {
    title: '台本评审',
    sub: '审核工作台 / 审核统计 / 台本验收 / 我的评审记录',
    stats: [
      { label: '待评审', value: 3, unit: '份' },
      { label: '评审中', value: 1, unit: '份' },
      { label: '已通过', value: 12, unit: '份' },
      { label: '我的评审', value: 5, unit: '份', accent: true }
    ],
    columns: [
      { key: 'id', title: '台本编号', width: '140px' },
      { key: 'name', title: '台本名称' },
      { key: 'from', title: '提交方', width: '120px' },
      { key: 'at', title: '提交时间', width: '150px' },
      { key: 'status', title: '状态', width: '100px' }
    ],
    rows: [
      { id: 'SC20261125001', name: '客服售后场景台本 v3', from: '客户方', at: '2026-11-25 08:40', status: '待审批' },
      { id: 'SC20261124006', name: '物流查询场景台本 v2', from: '客户方', at: '2026-11-24 15:10', status: '质检中' },
      { id: 'SC20261122003', name: '优惠券场景台本 v1', from: '客户方', at: '2026-11-22 11:25', status: '已通过' }
    ],
    note: '当前项目类型为长音频拉框，台本模块仅在剧本类项目启用。'
  },
  'mistake-square': {
    title: '错题广场',
    sub: '标注员错题 / 质检员错题',
    stats: [
      { label: '错题总数', value: 12, unit: '条' },
      { label: '待学习', value: 4, unit: '条' },
      { label: '参与人数', value: 9, unit: '人' },
      { label: '本月新增', value: 6, unit: '条', accent: true }
    ],
    filters: ['search', 'status'],
    columns: [
      { key: 'taskId', title: '任务号', width: '120px' },
      { key: 'annotator', title: '标注员', width: '100px' },
      { key: 'type', title: '错题类型', width: '130px' },
      { key: 'desc', title: '问题描述' },
      { key: 'createdAt', title: '创建时间', width: '150px' },
      { key: 'status', title: '学习状态', width: '110px' }
    ],
    rows: db.mistakes,
    note: '错题由质检拒绝或验收驳回自动沉淀，标注员需在「我的错题集」完成学习。'
  },
  'my-settings': {
    title: '我的配置',
    sub: '当前账号的通知与作业偏好',
    columns: [
      { key: 'name', title: '配置项', width: '220px' },
      { key: 'value', title: '当前值' },
      { key: 'updatedAt', title: '更新时间', width: '160px' }
    ],
    rows: [
      { name: '任务提醒', value: '开启（站内信 + 桌面通知）', updatedAt: '2026-11-20 09:12' },
      { name: '默认工作台', value: '长音频拉框工作台', updatedAt: '2026-11-18 14:30' },
      { name: '标注自动保存', value: '开启（每 30 秒）', updatedAt: '2026-11-12 10:05' },
      { name: '快捷键方案', value: '默认方案（空格播放 / Tab 下一个）', updatedAt: '2026-11-06 16:40' },
      { name: '语言', value: '简体中文', updatedAt: '2026-10-28 10:00' }
    ]
  },
  'tools': {
    title: '我的快捷工具',
    sub: '常用功能入口与自定义快捷方式',
    columns: [
      { key: 'name', title: '工具', width: '220px' },
      { key: 'desc', title: '说明' },
      { key: 'status', title: '状态', width: '110px' }
    ],
    rows: [
      { name: '连续标注', desc: '自动加载下一条待标注任务', status: '启用' },
      { name: '连续返修', desc: '按返修队列连续处理任务', status: '启用' },
      { name: '批量导入音频', desc: '上传整个文件夹并自动转任务', status: '启用' },
      { name: '快捷质检', desc: '质检页一键通过并跳到下一框', status: '停用' }
    ]
  },
  'guide': {
    title: '帮助中心',
    sub: '按角色与流程组织的操作指引',
    columns: [
      { key: 'name', title: '文档' },
      { key: 'role', title: '适用角色', width: '150px' },
      { key: 'stage', title: '流程阶段', width: '150px' },
      { key: 'updatedAt', title: '更新时间', width: '150px' }
    ],
    rows: [
      { name: '如何领取与连续标注任务', role: '标注员', stage: '标注', updatedAt: '2026-11-18' },
      { name: '拉框边界与说话人判定标准', role: '标注员 / 质检员', stage: '标注 / 质检', updatedAt: '2026-11-19' },
      { name: '质检逐框通过与整体打回', role: '质检员', stage: '质检', updatedAt: '2026-11-20' },
      { name: '返修对比视图使用说明', role: '标注员 / 项目经理', stage: '返修', updatedAt: '2026-11-22' },
      { name: '交付批次与验收节点提交', role: '项目经理 / 验收员', stage: '交付', updatedAt: '2026-11-24' }
    ],
    note: '帮助中心支持中 / 英 / 日三语（演示仅展示中文）。'
  }
}
