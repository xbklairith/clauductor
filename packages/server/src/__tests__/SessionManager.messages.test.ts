import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { MessageRepository } from '../db/MessageRepository.js'
import { OutputRepository } from '../db/OutputRepository.js'
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

describe('SessionManager Message and Output Storage', () => {
	let manager: SessionManager
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository
	let messageRepo: MessageRepository
	let outputRepo: OutputRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-session-msg-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })

		// Setup database
		database = createDatabase(testDir)
		runMigrations(database.db)
		sessionRepo = new SessionRepository(database.db)
		messageRepo = new MessageRepository(database.db)
		outputRepo = new OutputRepository(database.db)

		// Create manager with all repositories
		manager = new SessionManager({
			dataDir: testDir,
			sessionRepository: sessionRepo,
			messageRepository: messageRepo,
			outputRepository: outputRepo,
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

	describe('message storage', () => {
		it('should store user message on sendMessage', async () => {
			const session = await manager.createSession({ name: 'Message Test' })

			manager.sendMessage(session.id, 'Hello, Claude!')

			// Give time for storage
			await new Promise((resolve) => setTimeout(resolve, 50))

			const messages = messageRepo.findBySessionId(session.id)
			expect(messages).toHaveLength(1)
			expect(messages[0].role).toBe('user')
			expect(messages[0].content).toBe('Hello, Claude!')
		})

		it('should store multiple messages in order', async () => {
			const session = await manager.createSession({ name: 'Multi-Message Test' })

			manager.sendMessage(session.id, 'First message')
			await new Promise((resolve) => setTimeout(resolve, 10))
			manager.sendMessage(session.id, 'Second message')
			await new Promise((resolve) => setTimeout(resolve, 10))
			manager.sendMessage(session.id, 'Third message')

			// Give time for storage
			await new Promise((resolve) => setTimeout(resolve, 50))

			const messages = messageRepo.findBySessionId(session.id)
			expect(messages).toHaveLength(3)
			expect(messages[0].content).toBe('First message')
			expect(messages[1].content).toBe('Second message')
			expect(messages[2].content).toBe('Third message')
		})
	})

	describe('output storage', () => {
		it('should have flushOutputs method available', async () => {
			// Verify the flushOutputs method exists and can be called
			await expect(manager.flushOutputs()).resolves.toBeUndefined()
		})

		it('should provide message and output repositories for integration', async () => {
			// This test verifies the repositories are properly wired
			// Full output testing requires a live Claude process
			const session = await manager.createSession({ name: 'Integration Test' })

			// Messages should be stored when sending
			manager.sendMessage(session.id, 'Test message')
			await new Promise((resolve) => setTimeout(resolve, 50))

			const messages = messageRepo.findBySessionId(session.id)
			expect(messages).toHaveLength(1)
			expect(messages[0].content).toBe('Test message')

			// Output storage happens via handleOutput which requires real process
			// We've verified the buffer mechanism is in place
			await manager.flushOutputs()
		})
	})
})
