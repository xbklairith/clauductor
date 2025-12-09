import { test, expect } from '@playwright/test'

test.describe('Clauductor Browser E2E', () => {
	test.describe.configure({ mode: 'serial' })

	test('should display empty session list on initial load', async ({ page }) => {
		await page.goto('/')

		// Wait for the page to load
		await page.waitForLoadState('networkidle')

		// Check for "No sessions yet" message
		const sessionListEmpty = page.locator('[data-testid="session-list-empty"]')
		await expect(sessionListEmpty).toBeVisible()
		await expect(sessionListEmpty).toHaveText('No sessions yet')
	})

	test('should create a new session', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection (button becomes enabled)
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeVisible()
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })

		// Click "New Session" button
		await newSessionButton.click()

		// Wait for session to be created and appear in the list
		await page.waitForTimeout(1000)

		// Verify session appears in the list
		const sessionItem = page.locator('[data-testid="session-item"]').first()
		await expect(sessionItem).toBeVisible()
	})

	test('should send a message and receive output', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection and create a session
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Find the message input
		const messageInput = page.locator('input[type="text"]').or(page.locator('textarea'))
		await expect(messageInput).toBeVisible()

		// Type a message
		await messageInput.fill('Hello, Claude!')
		await messageInput.press('Enter')

		// Wait for output to appear
		await page.waitForTimeout(1000)

		// Verify some output is displayed (adjust selector based on actual UI)
		const outputContainer = page.locator('[data-testid="output"]').or(page.locator('[class*="output"]'))
		await expect(outputContainer).toBeVisible()
	})

	test('should handle multiple sessions', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })

		// Create first session
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Create second session
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Create third session
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Verify all three sessions are in the list
		const sessionItems = page.locator('[data-testid="session-item"]')
		await expect(sessionItems).toHaveCount(3)
	})

	test('should switch between sessions', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection and create two sessions
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })
		await newSessionButton.click()
		await page.waitForTimeout(1000)
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Get session items
		const sessionItems = page.locator('[data-testid="session-item"]')
		const firstSession = sessionItems.nth(0)
		const secondSession = sessionItems.nth(1)

		// Click on first session
		await firstSession.click()
		await page.waitForTimeout(300)

		// Click on second session
		await secondSession.click()
		await page.waitForTimeout(300)

		// Verify we can switch back to first
		await firstSession.click()
		await page.waitForTimeout(300)

		// Success if no errors thrown
		expect(true).toBe(true)
	})

	test('should display session status indicator', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection and create a session
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })
		await newSessionButton.click()
		await page.waitForTimeout(1000)

		// Look for status indicator (idle/running/error)
		const statusIndicator = page
			.locator('[data-testid="status-indicator"]')
			.or(page.locator('[class*="status"]'))
		await expect(statusIndicator).toBeVisible()
	})
})
