import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionManager } from '../services/SessionManager.js'

// Mock node-pty since it requires native bindings
vi.mock('node-pty', () => ({
	spawn: vi.fn(() => ({
		pid: 12345,
		onData: vi.fn(),
		onExit: vi.fn(),
		write: vi.fn(),
		resize: vi.fn(),
		kill: vi.fn(),
	})),
}))

describe('SessionManager', () => {
	let manager: SessionManager
	let testDir: string

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-session-test-${Date.now()}`)
		manager = new SessionManager({ dataDir: testDir })
	})

	afterEach(async () => {
		await manager.destroyAll()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('createSession', () => {
		it('should return Session with unique ID', async () => {
			const session = await manager.createSession()

			expect(session.id).toBeDefined()
			expect(session.id.length).toBeGreaterThan(0)
		})

		it('should use provided name', async () => {
			const session = await manager.createSession({ name: 'My Custom Session' })

			expect(session.name).toBe('My Custom Session')
		})

		it('should generate default name when not provided', async () => {
			const session = await manager.createSession()

			expect(session.name).toContain('Session')
		})

		it('should set initial status to idle', async () => {
			const session = await manager.createSession()

			expect(session.status).toBe('idle')
		})

		it('should set working directory', async () => {
			const tmpDir = os.tmpdir()
			const session = await manager.createSession({ workingDir: tmpDir })

			expect(session.workingDir).toBe(tmpDir)
		})

		it('should reject non-existent working directory', async () => {
			await expect(
				manager.createSession({ workingDir: '/nonexistent/path/that/does/not/exist' }),
			).rejects.toThrow('Working directory does not exist')
		})

		it('should reject path traversal attempts', async () => {
			await expect(manager.createSession({ workingDir: '../../../etc' })).rejects.toThrow(
				'path traversal not allowed',
			)
		})
	})

	describe('getSession', () => {
		it('should return session by ID', async () => {
			const created = await manager.createSession({ name: 'Find Me' })
			const found = manager.getSession(created.id)

			expect(found).toBeDefined()
			expect(found?.name).toBe('Find Me')
		})

		it('should return undefined for unknown ID', () => {
			const found = manager.getSession('non-existent')

			expect(found).toBeUndefined()
		})
	})

	describe('getAllSessions', () => {
		it('should return array of sessions', async () => {
			await manager.createSession({ name: 'Session 1' })
			await manager.createSession({ name: 'Session 2' })
			await manager.createSession({ name: 'Session 3' })

			const sessions = manager.getAllSessions()

			expect(sessions).toHaveLength(3)
		})

		it('should return empty array when no sessions', () => {
			const sessions = manager.getAllSessions()

			expect(sessions).toEqual([])
		})
	})

	describe('destroySession', () => {
		it('should remove session', async () => {
			const session = await manager.createSession()
			await manager.destroySession(session.id)

			const found = manager.getSession(session.id)
			expect(found).toBeUndefined()
		})

		it('should not throw for unknown session', async () => {
			await expect(manager.destroySession('non-existent')).resolves.toBeUndefined()
		})
	})

	describe('loadSessions', () => {
		it('should load sessions from files', async () => {
			// Create sessions and destroy manager
			await manager.createSession({ name: 'Persistent 1' })
			await manager.createSession({ name: 'Persistent 2' })

			// Create new manager pointing to same directory
			const newManager = new SessionManager({ dataDir: testDir })
			await newManager.loadSessions()

			const sessions = newManager.getAllSessions()
			expect(sessions).toHaveLength(2)

			await newManager.destroyAll()
		})
	})

	describe('events', () => {
		it('should emit status events', async () => {
			const statusHandler = vi.fn()
			manager.on('status', statusHandler)

			const session = await manager.createSession()
			manager.sendMessage(session.id, 'hello')

			// Status should change to running
			expect(statusHandler).toHaveBeenCalledWith(
				session.id,
				expect.objectContaining({
					sessionId: session.id,
					status: 'running',
				}),
			)
		})
	})
})
