import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Clauductor browser E2E tests.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: false, // Run serially to avoid port conflicts
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3001',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	// Build and start server before running tests
	webServer: {
		command: 'pnpm build && pnpm --filter @clauductor/server start -- --no-browser --port 3001',
		url: 'http://localhost:3001',
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
		stdout: 'pipe',
		stderr: 'pipe',
	},
})
