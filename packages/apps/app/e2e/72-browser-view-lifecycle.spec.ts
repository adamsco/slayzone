import { test, expect, seed, goHome, resetApp, TEST_PROJECT_PATH } from './fixtures/electron'
import {
  testInvoke, urlInput, tabEntries, newTabBtn,
  focusForAppShortcut, ensureBrowserPanelVisible, ensureBrowserPanelHidden,
  openTaskViaSearch, getViewsForTask, getAllViewIds, getActiveViewId,
} from './fixtures/browser-view'

test.describe('Browser view lifecycle (WebContentsView)', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'View Life', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Lifecycle task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Lifecycle task')
  })

  test('createView IPC directly creates a native child view (bypasses React)', async ({ mainWindow }) => {
    // Ensure no dialog overlay is hiding views (onboarding dialog on fresh DB)
    await testInvoke(mainWindow, 'browser:show-all')
    const countBefore = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number

    const viewId = await testInvoke(mainWindow, 'browser:create-view', {
      taskId: 'direct-test', tabId: 'direct-tab',
      partition: 'persist:browser-tabs',
      url: 'about:blank', bounds: { x: 0, y: 0, width: 100, height: 100 }
    }) as string | null

    expect(viewId, 'createView must return a viewId — null means mainWindow not ready').toBeTruthy()

    const countAfter = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number
    expect(countAfter, 'Native child view count must increase after createView').toBe(countBefore + 1)

    // Cleanup
    await testInvoke(mainWindow, 'browser:destroy-view', viewId)
  })

  test('creates view on browser panel open', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const views = await getViewsForTask(mainWindow, taskId)
    expect(views.length).toBeGreaterThanOrEqual(1)
  })

  test('browser panel open creates NATIVE child views (full React→IPC→Electron path)', async ({ mainWindow }) => {
    const nativeBefore = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number

    await ensureBrowserPanelVisible(mainWindow)

    // Must create at least one REAL native child view — not just a Map entry
    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number
    }, { timeout: 10000 }).toBeGreaterThan(nativeBefore)
  })

  test('creates separate view per tab', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const beforeViews = await getViewsForTask(mainWindow, taskId)

    await newTabBtn(mainWindow).click()
    await newTabBtn(mainWindow).click()
    await expect(tabEntries(mainWindow)).toHaveCount(beforeViews.length + 2)

    await expect.poll(async () => {
      const views = await getViewsForTask(mainWindow, taskId)
      return views.length
    }).toBe(beforeViews.length + 2)

    // Each view ID is unique
    const views = await getViewsForTask(mainWindow, taskId)
    expect(new Set(views).size).toBe(views.length)
  })

  test('destroys view on tab close', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewsBefore = await getViewsForTask(mainWindow, taskId)

    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })

    await expect.poll(async () => {
      return (await getViewsForTask(mainWindow, taskId)).length
    }).toBe(viewsBefore.length - 1)
  })

  test('destroys all views on browser panel close', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewsBefore = await getViewsForTask(mainWindow, taskId)
    expect(viewsBefore.length).toBeGreaterThan(0)

    // Count native child views BEFORE close
    const nativeCountBefore = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number

    await ensureBrowserPanelHidden(mainWindow)

    // Map should be empty
    await expect.poll(async () => {
      return (await getViewsForTask(mainWindow, taskId)).length
    }).toBe(0)

    // CRITICAL: Native child views must ALSO decrease — not just the Map
    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number
    }).toBeLessThan(nativeCountBefore)

    // Re-open for subsequent tests
    await ensureBrowserPanelVisible(mainWindow)
  })

  test('view has webContentsId (native backing)', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    const wcId = await testInvoke(mainWindow, 'browser:get-web-contents-id', viewId) as number | null
    expect(wcId).toBeGreaterThan(0)
  })

  test('destroyed view returns null from getUrl', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Create a second tab, get its viewId, then close it
    await newTabBtn(mainWindow).click()
    const views = await getViewsForTask(mainWindow, taskId)
    const lastViewId = views[views.length - 1]

    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })

    await expect.poll(async () => {
      const url = await testInvoke(mainWindow, 'browser:get-url', lastViewId)
      return url
    }).toBe('')
  })

  test('destroyed view webContents is actually dead', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Count native views before
    const nativeBefore = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number

    // Create a tab, get its viewId + webContentsId
    await newTabBtn(mainWindow).click()
    const views = await getViewsForTask(mainWindow, taskId)
    const lastViewId = views[views.length - 1]
    const wcId = await testInvoke(mainWindow, 'browser:get-web-contents-id', lastViewId) as number
    expect(wcId).toBeGreaterThan(0)

    // Native view count should have increased
    const nativeAfterCreate = await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number
    expect(nativeAfterCreate).toBeGreaterThan(nativeBefore)

    // Close the tab (destroys the view)
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })

    // webContentsId should now be null — process is dead, not just Map entry removed
    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:get-web-contents-id', lastViewId)
    }).toBeNull()

    // Native view count should have decreased back
    await expect.poll(async () => {
      return await testInvoke(mainWindow, 'browser:get-native-child-view-count') as number
    }).toBeLessThanOrEqual(nativeBefore + 1)
  })

  test('rapid tab create/close does not leak views', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const startingAllViews = (await getAllViewIds(mainWindow)).length
    const startingTabCount = await tabEntries(mainWindow).count()

    // Rapidly create and close 10 tabs
    for (let i = 0; i < 10; i++) {
      await newTabBtn(mainWindow).click()
      const count = await tabEntries(mainWindow).count()
      await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
    }

    // Final view count should not have grown
    await expect.poll(async () => {
      return (await getAllViewIds(mainWindow)).length
    }).toBeLessThanOrEqual(startingAllViews + 1)

    // Tab count should be back to starting
    await expect(tabEntries(mainWindow)).toHaveCount(startingTabCount)
  })

  test('tab switch hides old tab view, shows new (Bug 1)', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Create a second tab
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length).toBeGreaterThanOrEqual(2)

    const views = await getViewsForTask(mainWindow, taskId)
    const firstViewId = views[0]
    const secondViewId = views[views.length - 1]

    // Second tab is active — its view should be natively visible
    await mainWindow.waitForTimeout(500)
    const secondVisible = await testInvoke(mainWindow, 'browser:is-view-natively-visible', secondViewId) as boolean
    expect(secondVisible).toBe(true)

    // First tab is inactive — its view should be hidden
    const firstVisible = await testInvoke(mainWindow, 'browser:is-view-natively-visible', firstViewId) as boolean
    expect(firstVisible).toBe(false)

    // Switch to first tab
    await tabEntries(mainWindow).first().click()
    await mainWindow.waitForTimeout(500)

    // Now first should be visible, second hidden
    const firstVisibleAfter = await testInvoke(mainWindow, 'browser:is-view-natively-visible', firstViewId) as boolean
    expect(firstVisibleAfter).toBe(true)

    const secondVisibleAfter = await testInvoke(mainWindow, 'browser:is-view-natively-visible', secondViewId) as boolean
    expect(secondVisibleAfter).toBe(false)

    // Clean up: close second tab
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
  })

  test('view uses correct session partition', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    const partition = await testInvoke(mainWindow, 'browser:get-partition', viewId) as string
    expect(partition).toBe('persist:browser-tabs')
  })

  test('destroyAllForTask cleans up all views', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Create extra tabs
    await newTabBtn(mainWindow).click()
    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length).toBeGreaterThanOrEqual(2)

    // Destroy all via IPC
    await testInvoke(mainWindow, 'browser:destroy-all-for-task', taskId)

    await expect.poll(async () => (await getViewsForTask(mainWindow, taskId)).length).toBe(0)

    // Re-open panel to restore state
    await ensureBrowserPanelHidden(mainWindow)
    await ensureBrowserPanelVisible(mainWindow)
  })
})
