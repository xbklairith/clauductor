import { test, expect } from '@playwright/test'

test.describe('Debug Socket.io Connection', () => {
	test('should investigate connection status', async ({ page }) => {
		// Enable console logging
		page.on('console', (msg) => {
			console.log(`[BROWSER ${msg.type()}]:`, msg.text())
		})

		// Log network errors
		page.on('pageerror', (error) => {
			console.log(`[PAGE ERROR]:`, error.message)
		})

		// Log failed requests
		page.on('requestfailed', (request) => {
			console.log(`[REQUEST FAILED]:`, request.url(), request.failure()?.errorText)
		})

		console.log('\n=== Navigating to baseURL ===\n')
		await page.goto('/')
		await page.waitForLoadState('domcontentloaded')

		// Wait a bit for connection
		await page.waitForTimeout(5000)

		// Check if page loaded
		console.log('\n=== Page Title ===')
		const title = await page.title()
		console.log('Title:', title)

		// Take screenshot
		await page.screenshot({ path: 'test-results/debug-connection.png', fullPage: true })

		// Check connection status via browser console
		console.log('\n=== Checking Connection State ===')
		const connectionInfo = await page.evaluate(() => {
			// @ts-ignore - accessing window socket if available
			const socket = (window as any).socket
			return {
				socketExists: !!socket,
				socketConnected: socket?.connected || false,
				socketId: socket?.id || null,
				socketUrl: socket?.io?.uri || null,
			}
		})
		console.log('Socket info:', JSON.stringify(connectionInfo, null, 2))

		// Check if connection banner is visible
		const reconnectingBanner = await page
			.locator('text=/reconnecting/i')
			.isVisible()
			.catch(() => false)
		console.log('Reconnecting banner visible:', reconnectingBanner)

		// Check button state
		const newSessionButton = page.locator('[data-testid="new-session-button"]')
		const buttonExists = await newSessionButton.isVisible().catch(() => false)
		console.log('New Session button exists:', buttonExists)

		if (buttonExists) {
			const isEnabled = await newSessionButton.isEnabled()
			const isDisabled = await newSessionButton.isDisabled()
			const buttonText = await newSessionButton.textContent()
			console.log('Button enabled:', isEnabled)
			console.log('Button disabled:', isDisabled)
			console.log('Button text:', buttonText)

			const buttonHtml = await newSessionButton.evaluate((el) => el.outerHTML)
			console.log('Button HTML:', buttonHtml.substring(0, 200))
		}

		// Check if session list is visible
		const sessionListEmpty = await page
			.locator('[data-testid="session-list-empty"]')
			.isVisible()
			.catch(() => false)
		const sessionList = await page.locator('[data-testid="session-list"]').isVisible().catch(() => false)

		console.log('Empty session list visible:', sessionListEmpty)
		console.log('Session list visible:', sessionList)

		// Get network requests
		console.log('\n=== Network Activity ===')
		const requests = []
		page.on('request', (request) => {
			requests.push({
				url: request.url(),
				method: request.method(),
			})
		})

		await page.waitForTimeout(2000)

		// Check socket.io connection attempts
		const socketIoRequests = requests.filter((r) => r.url.includes('socket.io'))
		console.log('Socket.io requests:', socketIoRequests.length)
		socketIoRequests.forEach((r) => {
			console.log(`  ${r.method} ${r.url}`)
		})

		// Final diagnosis
		console.log('\n=== DIAGNOSIS ===')
		if (connectionInfo.socketConnected) {
			console.log('✅ Socket.io is CONNECTED')
		} else if (connectionInfo.socketExists) {
			console.log('❌ Socket exists but NOT connected')
		} else {
			console.log('❌ Socket.io client not initialized')
		}
	})
})
