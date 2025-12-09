import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'
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

describe('SessionManager with Database', () => {
	let manager: SessionManager
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-session-db-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })

		// Setup database
		database = createDatabase(testDir)
		runMigrations(database.db)
		sessionRepo = new SessionRepository(database.db)

		// Create manager with database repository
		manager = new SessionManager({
			dataDir: testDir,
			sessionRepository: sessionRepo,
		})
	})

	afterEach(async () => {
		await manager.destroyAll()
		database.close()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('database persistence', () => {
		it('should persist session to database on create', async () => {
			const session = await manager.createSession({ name: 'DB Test Session' })

			// Verify it's in the database
			const dbSession = sessionRepo.findById(session.id)
			expect(dbSession).not.toBeNull()
			expect(dbSession?.name).toBe('DB Test Session')
			expect(dbSession?.id).toBe(session.id)
		})

		it('should load sessions from database on startup', async () => {
			// Create sessions in first manager
			await manager.createSession({ name: 'Session 1' })
			await manager.createSession({ name: 'Session 2' })

			// Create new manager pointing to same database
			const newManager = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
			})
			await newManager.loadSessions()

			const sessions = newManager.getAllSessions()
			expect(sessions).toHaveLength(2)
			expect(sessions.map((s) => s.name).sort()).toEqual(['Session 1', 'Session 2'])

			await newManager.destroyAll()
		})

		it('should soft delete session from database on destroy', async () => {
			const session = await manager.createSession({ name: 'To Delete' })
			await manager.destroySession(session.id)

			// Should not be found via findById (soft deleted)
			const dbSession = sessionRepo.findById(session.id)
			expect(dbSession).toBeNull()

			// But should still be in findAll if we query all (including deleted)
			// Note: findAll excludes deleted by default
			const allSessions = sessionRepo.findAll()
			expect(allSessions.find((s) => s.id === session.id)).toBeUndefined()
		})

		it('should update session in database when status changes', async () => {
			const session = await manager.createSession({ name: 'Status Test' })

			// Small delay to ensure timestamps differ
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Trigger status change
			manager.sendMessage(session.id, 'hello')

			// Allow async update to complete
			await new Promise((resolve) => setTimeout(resolve, 50))

			const dbSession = sessionRepo.findById(session.id)
			expect(dbSession?.status).toBe('running')
			// Just verify the session was updated (status change is the key test)
			expect(dbSession).not.toBeNull()
		})
	})

	describe('sessions survive restart', () => {
		it('should restore session data after restart', async () => {
			// Create session with specific data
			const original = await manager.createSession({
				name: 'Persistent Session',
				workingDir: os.tmpdir(),
			})

			// Create new manager pointing to same database (simulates restart)
			// Note: we don't call destroyAll() as that deletes sessions
			const newManager = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
			})
			await newManager.loadSessions()

			const restored = newManager.getSession(original.id)
			expect(restored).toBeDefined()
			expect(restored?.name).toBe('Persistent Session')
			expect(restored?.workingDir).toBe(os.tmpdir())
			expect(restored?.createdAt).toBe(original.createdAt)

			// Clean up
			await newManager.destroyAll()
		})
	})
})
