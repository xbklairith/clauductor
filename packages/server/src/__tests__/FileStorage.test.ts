import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Session } from '@clauductor/shared'
import { FileStorage } from '../services/FileStorage.js'

describe('FileStorage', () => {
	let storage: FileStorage
	let testDir: string

	beforeEach(async () => {
		// Create a temp directory for tests
		testDir = path.join(os.tmpdir(), `clauductor-test-${Date.now()}`)
		storage = new FileStorage({ dataDir: testDir })
	})

	afterEach(async () => {
		// Clean up temp directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('getDataDir', () => {
		it('should return custom data dir when provided', () => {
			expect(storage.getDataDir()).toBe(testDir)
		})

		it('should return default ~/.clauductor when not provided', () => {
			const defaultStorage = new FileStorage()
			const expected = path.join(os.homedir(), '.clauductor')
			expect(defaultStorage.getDataDir()).toBe(expected)
		})
	})

	describe('ensureDataDir', () => {
		it('should create data directory if missing', async () => {
			await storage.ensureDataDir()

			const exists = await fs
				.access(storage.getSessionsDir())
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(true)
		})
	})

	describe('saveSession', () => {
		it('should write JSON file', async () => {
			const session: Session = {
				id: 'test-id',
				name: 'Test Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			}

			await storage.saveSession(session)

			const filePath = path.join(storage.getSessionsDir(), 'test-id.json')
			const content = await fs.readFile(filePath, 'utf-8')
			const saved = JSON.parse(content)

			expect(saved.id).toBe('test-id')
			expect(saved.name).toBe('Test Session')
		})
	})

	describe('loadSession', () => {
		it('should read JSON file', async () => {
			const session: Session = {
				id: 'load-test',
				name: 'Load Test',
				status: 'running',
				workingDir: '/home/user',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T01:00:00.000Z',
			}

			await storage.saveSession(session)
			const loaded = await storage.loadSession('load-test')

			expect(loaded).not.toBeNull()
			expect(loaded?.id).toBe('load-test')
			expect(loaded?.status).toBe('running')
		})

		it('should return null for non-existent session', async () => {
			const loaded = await storage.loadSession('non-existent')
			expect(loaded).toBeNull()
		})
	})

	describe('loadAllSessions', () => {
		it('should return array of sessions', async () => {
			const sessions: Session[] = [
				{
					id: 'session-1',
					name: 'Session 1',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
				{
					id: 'session-2',
					name: 'Session 2',
					status: 'running',
					workingDir: '/home',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
			]

			for (const session of sessions) {
				await storage.saveSession(session)
			}

			const loaded = await storage.loadAllSessions()

			expect(loaded).toHaveLength(2)
			expect(loaded.map((s) => s.id).sort()).toEqual(['session-1', 'session-2'])
		})

		it('should return empty array when no sessions', async () => {
			await storage.ensureDataDir()
			const loaded = await storage.loadAllSessions()
			expect(loaded).toEqual([])
		})
	})

	describe('deleteSession', () => {
		it('should remove file', async () => {
			const session: Session = {
				id: 'delete-me',
				name: 'Delete Me',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			}

			await storage.saveSession(session)
			await storage.deleteSession('delete-me')

			const loaded = await storage.loadSession('delete-me')
			expect(loaded).toBeNull()
		})

		it('should not throw for non-existent session', async () => {
			await expect(storage.deleteSession('non-existent')).resolves.toBeUndefined()
		})
	})
})
