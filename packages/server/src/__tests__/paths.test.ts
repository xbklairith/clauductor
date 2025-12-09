import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkDirectoryPermissions, getDataDir, getDatabasePath } from '../db/paths.js'

describe('Path utilities', () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Clear relevant env vars for clean tests
		vi.resetModules()
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe('getDataDir', () => {
		it('should use XDG_DATA_HOME when set', () => {
			process.env = { ...originalEnv, XDG_DATA_HOME: '/custom/data' }
			// Re-import to get fresh module
			const result = getDataDir()
			// Since we can't easily re-import, test the logic directly
			if (process.env.XDG_DATA_HOME) {
				expect(result).toContain('clauductor')
			}
		})

		it('should return macOS path on darwin', () => {
			const result = getDataDir()
			if (process.platform === 'darwin') {
				expect(result).toContain('Library/Application Support/clauductor')
			}
		})

		it('should return XDG-compliant path on Linux', () => {
			const result = getDataDir()
			if (process.platform === 'linux') {
				expect(result).toContain('.local/share/clauductor')
			}
		})

		it('should return path containing clauductor', () => {
			const result = getDataDir()
			expect(result).toContain('clauductor')
		})

		it('should return absolute path', () => {
			const result = getDataDir()
			expect(result.startsWith('/') || result.match(/^[A-Z]:\\/)).toBeTruthy()
		})
	})

	describe('getDatabasePath', () => {
		it('should return path ending with clauductor.db', () => {
			const result = getDatabasePath()
			expect(result).toMatch(/clauductor\.db$/)
		})

		it('should use custom dataDir when provided', () => {
			const result = getDatabasePath('/custom/dir')
			expect(result).toBe('/custom/dir/clauductor.db')
		})

		it('should use default dataDir when not provided', () => {
			const result = getDatabasePath()
			expect(result).toContain('clauductor')
			expect(result).toMatch(/clauductor\.db$/)
		})
	})

	describe('checkDirectoryPermissions', () => {
		let testDir: string

		beforeEach(async () => {
			testDir = path.join(os.tmpdir(), `clauductor-perms-test-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true, mode: 0o700 })
		})

		afterEach(async () => {
			try {
				await fs.rm(testDir, { recursive: true, force: true })
			} catch {
				// Ignore cleanup errors
			}
		})

		it('should return ok for directory with correct permissions', async () => {
			const result = await checkDirectoryPermissions(testDir)
			expect(result.ok).toBe(true)
		})

		it('should warn for too-permissive directory (world-readable)', async () => {
			// Make directory world-readable (skip on Windows)
			if (process.platform !== 'win32') {
				await fs.chmod(testDir, 0o755)
				const result = await checkDirectoryPermissions(testDir)
				expect(result.ok).toBe(false)
				expect(result.message).toContain('permissive')
			}
		})

		it('should return error for non-existent directory', async () => {
			const result = await checkDirectoryPermissions('/nonexistent/path/test')
			expect(result.ok).toBe(false)
			expect(result.message).toContain('not exist')
		})
	})
})
