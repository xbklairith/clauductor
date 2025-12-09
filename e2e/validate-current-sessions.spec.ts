import { test, expect } from '@playwright/test'

test.describe('Validate Current Sessions in UI', () => {
	test('should display all current sessions', async ({ page }) => {
		// Navigate to the running server
		await page.goto('http://localhost:3003')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection
		await page.waitForTimeout(2000)

		// Take a screenshot for validation
		await page.screenshot({ path: 'test-results/current-sessions.png', fullPage: true })

		// Check if there are sessions or empty state
		const sessionListEmpty = page.locator('[data-testid="session-list-empty"]')
		const sessionList = page.locator('[data-testid="session-list"]')
		const sessionItems = page.locator('[data-testid="session-item"]')

		const isEmpty = await sessionListEmpty.isVisible().catch(() => false)

		if (isEmpty) {
			console.log('✅ UI shows: No sessions yet')
			await expect(sessionListEmpty).toHaveText('No sessions yet')
		} else {
			const sessionCount = await sessionItems.count()
			console.log(`✅ UI shows: ${sessionCount} session(s)`)

			// List all session names
			for (let i = 0; i < sessionCount; i++) {
				const sessionText = await sessionItems.nth(i).textContent()
				console.log(`  Session ${i + 1}: ${sessionText}`)
			}

			expect(sessionCount).toBeGreaterThan(0)
		}

		// Verify New Session button is visible and enabled
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeVisible()

		const isEnabled = await newSessionButton.isEnabled()
		if (isEnabled) {
			console.log('✅ Socket.io connected (New Session button is enabled)')
		} else {
			console.log('⚠️  Socket.io not connected (New Session button is disabled)')
		}
	})

	test('should allow creating a new session and display it', async ({ page }) => {
		await page.goto('http://localhost:3003')
		await page.waitForLoadState('networkidle')

		// Wait for socket connection
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		await expect(newSessionButton).toBeEnabled({ timeout: 10000 })

		// Count existing sessions
		const sessionItems = page.locator('[data-testid="session-item"]')
		const initialCount = await sessionItems.count().catch(() => 0)

		console.log(`Initial session count: ${initialCount}`)

		// Create a new session
		await newSessionButton.click()
		await page.waitForTimeout(2000)

		// Verify session was created
		const newCount = await sessionItems.count()
		console.log(`New session count: ${newCount}`)

		expect(newCount).toBe(initialCount + 1)

		// Take screenshot
		await page.screenshot({ path: 'test-results/after-creating-session.png', fullPage: true })
	})
})
