import { reactive } from 'vue'
import {
  batches, invalidReasons, members, mistakes, nodes, orgs, permissions,
  projects, qualityRecords, reworkItems, roleNames, tasks
} from './data'
import type { Segment, Task } from './types'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export const db = reactive({
  orgs: clone(orgs),
  projects: clone(projects),
  tasks: clone(tasks),
  reworkItems: clone(reworkItems),
  batches: clone(batches),
  nodes: clone(nodes),
  members: clone(members),
  mistakes: clone(mistakes),
  permissions: clone(permissions),
  roleNames: clone(roleNames),
  qualityRecords: clone(qualityRecords),
  invalidReasons: clone(invalidReasons)
})

export function projectById(id: number) {
  return db.projects.find((p) => p.id === id)
}

export function taskById(id: number): Task | undefined {
  return db.tasks.find((t) => t.id === id)
}

export function myTasks(projectId: number) {
  return db.tasks.filter((t) => t.projectId === projectId && t.assignee === '我' && t.status === '标注中')
}

export function pendingTasks(projectId: number) {
  return db.tasks.filter((t) => t.projectId === projectId && t.status === '待领取')
}

export function qcPendingTasks(projectId: number) {
  return db.tasks.filter((t) => t.projectId === projectId && (t.status === '待质检' || t.status === '质检中'))
}

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

export function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function segmentStats(segments: Segment[], mode: 'annotate' | 'qc' = 'annotate') {
  if (mode === 'qc') {
    return {
      passed: segments.filter((s) => s.status === 'passed').length,
      rejected: segments.filter((s) => s.status === 'rejected').length,
      pending: segments.filter((s) => s.status !== 'passed' && s.status !== 'rejected').length
    }
  }
  return {
    pending: segments.filter((s) => s.status === 'pending').length,
    draft: segments.filter((s) => s.status === 'draft').length,
    done: segments.filter((s) => s.status === 'done').length
  }
}

export function taskStatusTag(status: string): string {
  if (status === '活跃' || status === '启用' || status === '已通过' || status === '已完成') return 'green dot'
  const map: Record<string, string> = {
    待领取: 'gray', 标注中: 'blue', 待质检: 'orange', 质检中: 'orange',
    已通过: 'green', 已退回: 'red', 待返修: 'orange', 返修中: 'blue', 已完成: 'green',
    正常: 'green', 已禁用: 'gray', 待入职: 'orange', 活跃: 'green', 停用: 'gray',
    启用: 'green', 普通成员: 'gray',
    已接收: 'green', 待接收: 'orange', 待学习: 'orange', 已学习: 'green',
    通过: 'green', 不通过: 'red', 已结束: 'gray', 进行中: 'blue', 已暂停: 'orange'
  }
  return map[status] || 'gray'
}
