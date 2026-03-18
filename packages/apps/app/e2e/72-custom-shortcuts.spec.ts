import { test, expect, seed, goHome, clickProject, resetApp } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe.serial('Custom keyboard shortcuts', () => {
  let projectAbbrev: string

  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)
    const p = await s.createProject({ name: 'Shortcuts Test', color: '#06b6d4', path: TEST_PROJECT_PATH })
    projectAbbrev = p.name.slice(0, 2).toUpperCase()
    await s.createTask({ projectId: p.id, title: 'Shortcut task', status: 'in_progress' })
    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 5_000 })
  })

  test('opens shortcuts dialog via sidebar button', async ({ mainWindow }) => {
    await mainWindow.getByLabel('Keyboard Shortcuts').click()
    await expect(mainWindow.getByText('Keyboard Shortcuts').first()).toBeVisible({ timeout: 3_000 })
    // Close
    await mainWindow.keyboard.press('Escape')
  })

  test('rebind search shortcut and verify it works', async ({ mainWindow }) => {
    // Open shortcuts dialog
    await mainWindow.getByLabel('Keyboard Shortcuts').click()
    await expect(mainWindow.getByRole('dialog')).toBeVisible({ timeout: 3_000 })

    // Open the General group (first group, should be open by default)
    // Find and click the Search shortcut key badge to start recording
    const searchRow = mainWindow.getByRole('dialog').locator('div').filter({ hasText: /^Search/ }).first()
    // Click the key badge (the span with the shortcut display)
    await searchRow.locator('span.cursor-pointer').click()

    // Should see "Press keys..." indicating recording mode
    await expect(mainWindow.getByText('Press keys...')).toBeVisible({ timeout: 2_000 })

    // Press the new key combo
    await mainWindow.keyboard.press('Meta+/')

    // Close dialog
    await mainWindow.keyboard.press('Escape')
    // Small delay for dialog to close
    await mainWindow.waitForTimeout(200)

    // Press the NEW shortcut — should open search
    await mainWindow.keyboard.press('Meta+/')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')

    // Press the OLD shortcut — should NOT open search
    await mainWindow.keyboard.press('Meta+k')
    // Wait briefly and verify search did not open
    await mainWindow.waitForTimeout(500)
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).not.toBeVisible()
  })

  test('reset to defaults restores original shortcuts', async ({ mainWindow }) => {
    // Open shortcuts dialog
    await mainWindow.getByLabel('Keyboard Shortcuts').click()
    await expect(mainWindow.getByRole('dialog')).toBeVisible({ timeout: 3_000 })

    // Click "Reset to Defaults"
    await mainWindow.getByText('Reset to Defaults').click()

    // Close dialog
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)

    // Original Cmd+K should work again
    await mainWindow.keyboard.press('Meta+k')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')
  })

  test('shortcut persists after page reload', async ({ mainWindow }) => {
    // Rebind search to Cmd+/
    await mainWindow.getByLabel('Keyboard Shortcuts').click()
    await expect(mainWindow.getByRole('dialog')).toBeVisible({ timeout: 3_000 })

    const searchRow = mainWindow.getByRole('dialog').locator('div').filter({ hasText: /^Search/ }).first()
    await searchRow.locator('span.cursor-pointer').click()
    await expect(mainWindow.getByText('Press keys...')).toBeVisible({ timeout: 2_000 })
    await mainWindow.keyboard.press('Meta+/')
    await mainWindow.keyboard.press('Escape')
    await mainWindow.waitForTimeout(200)

    // Reload the page
    await mainWindow.reload({ waitUntil: 'domcontentloaded' })
    await mainWindow.waitForSelector('#root', { timeout: 10_000 })
    await goHome(mainWindow)
    await clickProject(mainWindow, projectAbbrev)
    await expect(mainWindow.locator('h3').getByText('Inbox', { exact: true })).toBeVisible({ timeout: 5_000 })

    // Custom shortcut should still work
    await mainWindow.keyboard.press('Meta+/')
    await expect(mainWindow.getByPlaceholder('Search tasks and projects...')).toBeVisible({ timeout: 3_000 })
    await mainWindow.keyboard.press('Escape')

    // Clean up: reset to defaults
    await mainWindow.getByLabel('Keyboard Shortcuts').click()
    await expect(mainWindow.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
    await mainWindow.getByText('Reset to Defaults').click()
    await mainWindow.keyboard.press('Escape')
  })
})
