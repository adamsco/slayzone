import { webContents } from 'electron'

// taskId → webContentsId (only set when tab 0 is active)
const registry = new Map<string, number>()

interface PendingRegistration {
  resolve: (wc: Electron.WebContents) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingRegistrations = new Map<string, PendingRegistration>()

export function registerBrowserPanel(taskId: string, webContentsId: number): void {
  registry.set(taskId, webContentsId)
  const wc = webContents.fromId(webContentsId)
  if (wc) {
    wc.once('destroyed', () => {
      if (registry.get(taskId) === webContentsId) {
        registry.delete(taskId)
      }
    })

    const pending = pendingRegistrations.get(taskId)
    if (pending) {
      clearTimeout(pending.timer)
      pendingRegistrations.delete(taskId)
      pending.resolve(wc)
    }
  }
}

export function unregisterBrowserPanel(taskId: string): void {
  registry.delete(taskId)
}

export function clearBrowserRegistry(): void {
  registry.clear()
  for (const [, pending] of pendingRegistrations) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Browser registry cleared'))
  }
  pendingRegistrations.clear()
}

export function getBrowserWebContents(taskId: string): Electron.WebContents | null {
  const id = registry.get(taskId)
  if (id == null) return null
  const wc = webContents.fromId(id)
  if (!wc || wc.isDestroyed()) {
    registry.delete(taskId)
    return null
  }
  return wc
}

export function waitForBrowserRegistration(taskId: string, timeoutMs = 10_000): Promise<Electron.WebContents> {
  // If already registered, return immediately
  const existing = getBrowserWebContents(taskId)
  if (existing) return Promise.resolve(existing)

  // Cancel any previous pending registration for this task
  const prev = pendingRegistrations.get(taskId)
  if (prev) {
    clearTimeout(prev.timer)
    prev.reject(new Error('Superseded by new registration request'))
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRegistrations.delete(taskId)
      reject(new Error('Browser panel did not open within timeout. Is the task tab active?'))
    }, timeoutMs)

    pendingRegistrations.set(taskId, { resolve, reject, timer })
  })
}
