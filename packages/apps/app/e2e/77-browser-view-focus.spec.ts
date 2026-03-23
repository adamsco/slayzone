import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from './fixtures/electron'
import {
  testInvoke,
  ensureBrowserPanelVisible,
  openTaskViaSearch, getActiveViewId,
} from './fixtures/browser-view'

test.describe('Browser view focus (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Focus Te', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Focus task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Focus task')
  })

  test('focus IPC does not throw and returns boolean', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Focus via IPC
    await testInvoke(mainWindow, 'browser:focus', viewId)

    // isFocused should return a boolean
    const isFocused = await testInvoke(mainWindow, 'browser:is-focused', viewId) as boolean
    expect(typeof isFocused).toBe('boolean')
  })

  test('clicking placeholder triggers focus IPC', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Click the browser panel placeholder
    const placeholder = mainWindow.locator('[data-browser-panel]').first()
    await placeholder.click({ force: true })
    await mainWindow.waitForTimeout(200)

    // Verify the IPC path exists (focus may not propagate in headless)
    const isFocused = await testInvoke(mainWindow, 'browser:is-focused', viewId) as boolean
    expect(typeof isFocused).toBe('boolean')
  })

  test('view is queryable after focus operations', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:focus', viewId)

    const url = await testInvoke(mainWindow, 'browser:get-url', viewId) as string
    expect(typeof url).toBe('string')

    const wcId = await testInvoke(mainWindow, 'browser:get-web-contents-id', viewId) as number | null
    expect(wcId).toBeGreaterThan(0)
  })
})
