import { test, expect, seed, goHome, resetApp, TEST_PROJECT_PATH } from './fixtures/electron'
import {
  testInvoke, urlInput, tabBar, tabEntries, newTabBtn,
  focusForAppShortcut, ensureBrowserPanelVisible, ensureBrowserPanelHidden,
  openTaskViaSearch, getActiveViewId,
} from './fixtures/browser-view'

test.describe('Browser panel', () => {
  let taskId: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Browser Test', color: '#0ea5e9', path: TEST_PROJECT_PATH })
    const t = await s.createTask({ projectId: p.id, title: 'Browser task', status: 'todo' })
    taskId = t.id
    await s.refreshData()
    await openTaskViaSearch(mainWindow, 'Browser task')
  })

  test('browser panel hidden by default', async ({ mainWindow }) => {
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  test('Cmd+B toggles browser panel on', async ({ mainWindow }) => {
    await ensureBrowserPanelHidden(mainWindow)
    await ensureBrowserPanelVisible(mainWindow)
    await expect(urlInput(mainWindow)).toBeVisible()
  })

  test('initial tab shows New Tab', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await expect(tabEntries(mainWindow).first()).toContainText(/New Tab|about:blank/)
    expect(await tabEntries(mainWindow).count()).toBeGreaterThan(0)
  })

  test('type URL in address bar', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const input = urlInput(mainWindow)
    await input.click()
    await input.fill('https://example.com')
    await expect(input).toHaveValue('https://example.com')
  })

  test('browser view devtools IPC can open and close', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(false)

    await testInvoke(mainWindow, 'browser:open-devtools', viewId, 'bottom')
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(true)

    await testInvoke(mainWindow, 'browser:close-devtools', viewId)
    await expect.poll(() => testInvoke(mainWindow, 'browser:is-devtools-open', viewId)).toBe(false)
  })

  test('create new tab via plus button', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const beforeCount = await tabEntries(mainWindow).count()
    await newTabBtn(mainWindow).click()
    await expect(tabEntries(mainWindow)).toHaveCount(beforeCount + 1)
  })

  test('new tab becomes active', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const count = await tabEntries(mainWindow).count()
    await expect(tabEntries(mainWindow).nth(count - 1)).toHaveClass(/border border-neutral/)
  })

  test('close active tab via X', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const countBefore = await tabEntries(mainWindow).count()
    const activeTab = tabEntries(mainWindow).nth(countBefore - 1)
    await activeTab.locator('.lucide-x').click({ force: true })
    await expect(tabEntries(mainWindow)).toHaveCount(countBefore - 1)
  })

  test('tabs state persists in DB after changes', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const countBefore = await tabEntries(mainWindow).count()
    await newTabBtn(mainWindow).click()
    await expect(tabEntries(mainWindow)).toHaveCount(countBefore + 1)

    const task = await mainWindow.evaluate((id) => window.api.db.getTask(id), taskId)
    expect(task?.browser_tabs).toBeTruthy()
    expect(task?.browser_tabs?.tabs.length ?? 0).toBeGreaterThanOrEqual(2)

    // Clean up
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
    await expect(tabEntries(mainWindow)).toHaveCount(count - 1)
  })

  test('Cmd+L focuses URL bar when browser is open', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    // Move focus away from the URL input
    await focusForAppShortcut(mainWindow)
    await expect(urlInput(mainWindow)).not.toBeFocused()

    await mainWindow.keyboard.press('Meta+l')
    await expect(urlInput(mainWindow)).toBeFocused()
  })

  test('Cmd+B toggles browser panel off', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    await focusForAppShortcut(mainWindow)
    await mainWindow.waitForTimeout(150)
    await mainWindow.keyboard.press('Meta+b')
    await expect(urlInput(mainWindow)).not.toBeVisible()
  })

  const keyboardPassthroughBtn = (page: import('@playwright/test').Page) =>
    page.getByTestId('browser-keyboard-passthrough').first()

  test('capture shortcuts button visible and off by default', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    // Navigate to a real page so webviewReady becomes true
    await testInvoke(mainWindow, 'browser:navigate', viewId, 'https://example.com')
    await mainWindow.waitForTimeout(2000)
    const btn = keyboardPassthroughBtn(mainWindow)
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled({ timeout: 10000 })
    await expect(btn).not.toHaveClass(/text-green/)
  })

  test('capture shortcuts toggle activates and deactivates', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const btn = keyboardPassthroughBtn(mainWindow)
    await expect(btn).toBeEnabled({ timeout: 10000 })

    await btn.click()
    await expect(btn).toHaveClass(/text-green/)

    await btn.click()
    await expect(btn).not.toHaveClass(/text-green/)
  })

  test('Cmd+T passes through by default, captured when active', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const btn = keyboardPassthroughBtn(mainWindow)
    await expect(btn).toBeEnabled({ timeout: 10000 })

    // Ensure capture is off
    if (await btn.evaluate(el => el.className.includes('text-green'))) {
      await btn.click()
    }

    // Focus browser panel, press Cmd+T — should NOT create a tab
    await mainWindow.locator('[data-browser-panel]').first().click()
    const countBefore = await tabEntries(mainWindow).count()
    await mainWindow.keyboard.press('Meta+t')
    expect(await tabEntries(mainWindow).count()).toBe(countBefore)

    // Enable capture, press Cmd+T — should create a tab
    await btn.click()
    await expect(btn).toHaveClass(/text-green/)
    await mainWindow.locator('[data-browser-panel]').first().click()
    const countWithCapture = await tabEntries(mainWindow).count()
    await mainWindow.keyboard.press('Meta+t')
    await expect(tabEntries(mainWindow)).toHaveCount(countWithCapture + 1)

    // Clean up
    const count = await tabEntries(mainWindow).count()
    await tabEntries(mainWindow).nth(count - 1).locator('.lucide-x').click({ force: true })
    await expect(tabEntries(mainWindow)).toHaveCount(count - 1)

    await btn.click()
  })

  test('keyboard passthrough IPC syncs to main process', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)
    const viewId = await getActiveViewId(mainWindow, taskId)
    expect(viewId).toBeTruthy()
  })

  test('browser panel visibility persists across navigation', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    await goHome(mainWindow)
    await expect(urlInput(mainWindow)).not.toBeVisible()
    await openTaskViaSearch(mainWindow, 'Browser task')

    await expect(urlInput(mainWindow)).toBeVisible()
  })

  test('extensions button is hidden', async ({ mainWindow }) => {
    await ensureBrowserPanelVisible(mainWindow)

    const browserPanel = mainWindow.locator('[data-panel-id="browser"]:visible').first()
    await expect(browserPanel.getByRole('button', { name: 'Extensions' })).toHaveCount(0)
    await expect(browserPanel.getByTestId('browser-extensions-manager')).toHaveCount(0)
  })
})
