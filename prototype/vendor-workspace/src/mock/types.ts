export interface Org {
  code: string
  name: string
  role: string
  vendor: boolean
  members: number
}

export interface Project {
  id: number
  code: string
  name: string
  type: string
  lang: string
  status: '进行中' | '已结束' | '已暂停'
  targetHours: number
  allocatedHours: number
  planHours?: number
  planAssigned?: number
  createdAt: string
  owner: string
  subOrgs: { name: string; hours: number; at: string; status: string }[]
  counts: { total: number; pending: number; doing: number; draft: number; done: number }
}

export type SegmentStatus = 'pending' | 'draft' | 'done' | 'passed' | 'rejected'

export interface Segment {
  id: number
  idx: number
  start: number
  end: number
  speaker: string
  status: SegmentStatus
  text: string
  qcNote?: string
  easy: boolean
}

export interface Task {
  id: number
  projectId: number
  duration: number
  segments: Segment[]
  status: '待领取' | '标注中' | '待质检' | '质检中' | '已通过' | '已退回'
  assignee: string
  qcNode: string
  submittedAt?: string
  updatedAt?: string
  rework?: boolean
}

export interface ReworkItem {
  taskId: number
  method: '单条返修' | '整体返修'
  reason: string
  times: number
  annotator: string
  status: '待返修' | '返修中' | '已完成'
  updatedAt: string
}

export interface Batch {
  id: string
  projectId: number
  name: string
  tasks: number
  hours: number
  status: string
  acceptor: string
  createdAt: string
}

export interface Member {
  id: number
  name: string
  account: string
  phone: string
  role: string
  orgRole: string
  dept: string
  subOrg: string
  status: '活跃' | '停用'
  joinedAt: string
  tasks: number
  recording: string
}

export interface Mistake {
  id: number
  taskId: number
  annotator: string
  type: string
  desc: string
  createdAt: string
  status: '待学习' | '已学习'
}

export interface PermissionRow {
  group: string
  code: string
  label: string
  roles: Record<string, boolean>
}

export interface QualityRecord {
  taskId: number
  annotator: string
  ai: '通过' | '不通过'
  issues: number
  text: string
  qcAt: string
}
