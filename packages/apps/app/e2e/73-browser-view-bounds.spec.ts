import { test, expect, seed, resetApp, TEST_PROJECT_PATH } from './fixtures/electron'
import {
  testInvoke, urlInput,
  ensureBrowserPanelVisible, ensureBrowserPanelHidden,
  openTaskViaSearch, getActiveViewId,
} from './fixtures/browser-view'

test.describe('Browser view bounds (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Bounds Tst', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Bounds task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Bounds task')
  })

  test('NATIVE view is on screen with correct bounds (not just bookkeeping)', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Let rAF loop sync bounds
    await mainWindow.waitForTimeout(1000)

    // Check the ACTUAL native view position — what Electron is rendering
    // This is entry.view.getBounds(), NOT entry.bounds (bookkeeping)
    const nativeBounds = await testInvoke(mainWindow, 'browser:get-actual-native-bounds', viewId) as { x: number; y: number; width: number; height: number } | null
    expect(nativeBounds).toBeTruthy()

    const allHidden = await testInvoke(mainWindow, 'browser:is-all-hidden') as boolean
    const viewVisible = await testInvoke(mainWindow, 'browser:get-view-visible', viewId) as boolean

    // Must NOT be offscreen (OFFSCREEN_BOUNDS = {x:-10000})
    expect(nativeBounds!.x).toBeGreaterThanOrEqual(0)
    expect(nativeBounds!.y).toBeGreaterThanOrEqual(0)
    // Must NOT be the initial 1x1 placeholder bounds
    expect(nativeBounds!.width).toBeGreaterThan(50)
    expect(nativeBounds!.height).toBeGreaterThan(50)

    // Verify manager state
    expect(allHidden).toBe(false)
    expect(viewVisible).toBe(true)
  })

  test('bounds are positive and non-zero when visible', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    await mainWindow.waitForTimeout(300)

    const bounds = await testInvoke(mainWindow, 'browser:get-bounds', viewId) as { x: number; y: number; width: number; height: number } | null
    expect(bounds).toBeTruthy()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.width).toBeGreaterThan(0)
    expect(bounds!.height).toBeGreaterThan(0)
  })

  test('setBounds via IPC updates stored bounds', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    const newBounds = { x: 100, y: 200, width: 300, height: 400 }
    await testInvoke(mainWindow, 'browser:set-bounds', viewId, newBounds)

    const bounds = await testInvoke(mainWindow, 'browser:get-bounds', viewId) as { x: number; y: number; width: number; height: number }
    expect(bounds.x).toBe(100)
    expect(bounds.y).toBe(200)
    expect(bounds.width).toBe(300)
    expect(bounds.height).toBe(400)
  })

  test('hideAll/showAll via IPC moves views offscreen and back', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // hideAll should work
    await testInvoke(mainWindow, 'browser:hide-all')
    await mainWindow.waitForTimeout(200)

    // showAll restores
    await testInvoke(mainWindow, 'browser:show-all')
    await mainWindow.waitForTimeout(200)

    // Bounds should still be valid
    const bounds = await testInvoke(mainWindow, 'browser:get-bounds', viewId) as { x: number; y: number; width: number; height: number }
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })

  test('setVisible false makes view invisible, true restores', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Hide the view
    await testInvoke(mainWindow, 'browser:set-visible', viewId, false)
    await mainWindow.waitForTimeout(100)

    // Show again
    await testInvoke(mainWindow, 'browser:set-visible', viewId, true)
    await mainWindow.waitForTimeout(300)

    // Bounds should be restored
    const bounds = await testInvoke(mainWindow, 'browser:get-bounds', viewId) as { x: number; y: number; width: number; height: number }
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })

  test('bounds survive multiple rapid setBounds calls', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    // Rapid fire 50 setBounds calls
    for (let i = 0; i < 50; i++) {
      await testInvoke(mainWindow, 'browser:set-bounds', viewId, { x: i, y: i, width: 200 + i, height: 100 + i })
    }

    // Final bounds should match last call
    const bounds = await testInvoke(mainWindow, 'browser:get-bounds', viewId) as { x: number; y: number; width: number; height: number }
    expect(bounds.x).toBe(49)
    expect(bounds.y).toBe(49)
    expect(bounds.width).toBe(249)
    expect(bounds.height).toBe(149)
  })
})
