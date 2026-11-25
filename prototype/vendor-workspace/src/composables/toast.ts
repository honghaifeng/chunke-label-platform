import { reactive } from 'vue'

export interface ToastItem {
  id: number
  text: string
  type: 'ok' | 'err' | 'info'
}

export const toasts = reactive<ToastItem[]>([])

let seed = 1

export function toast(text: string, type: ToastItem['type'] = 'info') {
  const id = seed++
  toasts.push({ id, text, type })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, 2200)
}
