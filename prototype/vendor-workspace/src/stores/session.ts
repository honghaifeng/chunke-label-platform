import { defineStore } from 'pinia'

export interface SessionUser {
  name: string
  account: string
  role: string
}

interface SessionState {
  loggedIn: boolean
  user: SessionUser
  orgCode: string
}

const KEY = 'dingtag-vendor-demo-session'

function load(): SessionState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as SessionState
  } catch {
    /* ignore */
  }
  return {
    loggedIn: false,
    user: { name: '陈可', account: 'chunke_001', role: '组织管理员' },
    orgCode: ''
  }
}

export const useSession = defineStore('session', {
  state: (): SessionState => load(),
  actions: {
    persist() {
      localStorage.setItem(KEY, JSON.stringify({ loggedIn: this.loggedIn, user: this.user, orgCode: this.orgCode }))
    },
    login(account: string) {
      this.loggedIn = true
      this.user.account = account || 'chunke_001'
      this.persist()
    },
    selectOrg(code: string) {
      this.orgCode = code
      this.persist()
    },
    logout() {
      this.loggedIn = false
      this.orgCode = ''
      this.persist()
    }
  }
})
