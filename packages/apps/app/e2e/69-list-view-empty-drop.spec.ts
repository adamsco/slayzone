import { test, expect, seed, goHome, clickProject, resetApp } from './fixtures/electron'
import { TEST_PROJECT_PATH } from './fixtures/electron'

test.describe('List view: drop into empty status group', () => {
  test.beforeAll(async ({ mainWindow }) => {
    await resetApp(mainWindow)
    const s = seed(mainWindow)

    // Create project with default columns (inbox, backlog, todo, in_progress, review, done, canceled)
    const project = await s.createProject({ name: 'List Drop', color: '#8b5cf6', path: TEST_PROJECT_PATH })

    // Seed tasks only in todo — leave review empty
    await s.createTask({ projectId: project.id, title: 'Move me to review', status: 'todo' })
    await s.createTask({ projectId: project.id, title: 'Stay in todo', status: 'todo' })

    await s.refreshData()
    await goHome(mainWindow)
    await clickProject(mainWindow, 'LI')
    await expect(mainWindow.getByText('Move me to review').first()).toBeVisible({ timeout: 5_000 })
  })

  test('can drop task into empty status group', async ({ mainWindow }) => {
    // Switch to list view
    await mainWindow.getByRole('button', { name: /Display/ }).first().click()
    await mainWindow.getByRole('button', { name: 'List' }).click()

    // Ensure grouped by status (default)
    // Enable show empty groups so the Review group is visible
    const emptySwitch = mainWindow.locator('#display-empty-cols')
    const isChecked = await emptySwitch.isChecked()
    if (!isChecked) await emptySwitch.click()

    // Close display popover by pressing Escape
    await mainWindow.keyboard.press('Escape')

    // Verify Review group header visible (empty group)
    const reviewHeader = mainWindow.getByText('Review', { exact: true })
    await expect(reviewHeader).toBeVisible({ timeout: 3_000 })

    // Verify the task count badge shows 0 for Review
    const reviewSection = reviewHeader.locator('..')
    await expect(reviewSection.getByText('0')).toBeVisible()

    // Drag "Move me to review" into the Review group
    const dragCard = mainWindow.getByText('Move me to review').first()
    const cardBox = await dragCard.boundingBox()
    const reviewBox = await reviewHeader.boundingBox()

    expect(cardBox).toBeTruthy()
    expect(reviewBox).toBeTruthy()

    // Perform drag
    await mainWindow.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2)
    await mainWindow.mouse.down()
    await mainWindow.waitForTimeout(200)

    // Drop below the Review header (into the empty group area)
    await mainWindow.mouse.move(
      reviewBox!.x + reviewBox!.width / 2,
      reviewBox!.y + reviewBox!.height + 20,
      { steps: 10 }
    )
    await mainWindow.mouse.up()
    await mainWindow.waitForTimeout(500)

    // Verify task moved to review status
    const tasks = await seed(mainWindow).getTasks()
    const movedTask = tasks.find((t: { title: string }) => t.title === 'Move me to review')
    expect(movedTask?.status).toBe('review')
  })
})
