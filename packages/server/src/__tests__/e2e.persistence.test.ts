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
import { getSessionHistory } from '../utils/history.js'
import { initializeContinueMode } from '../utils/continueMode.js'

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

describe('End-to-End Session Persistence', () => {
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository
	let messageRepo: MessageRepository
	let outputRepo: OutputRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-e2e-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		sessionRepo = new SessionRepository(database.db)
		messageRepo = new MessageRepository(database.db)
		outputRepo = new OutputRepository(database.db)
	})

	afterEach(async () => {
		database.close()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('full workflow: create → message → output → restart → resume', () => {
		it('should persist session data across simulated restart', async () => {
			// Step 1: Create first SessionManager instance
			const manager1 = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
				messageRepository: messageRepo,
				outputRepository: outputRepo,
			})

			// Step 2: Create a session
			const session = await manager1.createSession({ name: 'E2E Test Session' })
			expect(session.id).toBeDefined()
			expect(session.name).toBe('E2E Test Session')

			// Step 3: Send messages
			manager1.sendMessage(session.id, 'Hello, this is the first message')
			await new Promise((resolve) => setTimeout(resolve, 50))
			manager1.sendMessage(session.id, 'This is the second message')
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Step 4: Store some output (simulating assistant response)
			outputRepo.create({
				sessionId: session.id,
				type: 'parsed',
				content: 'Hello! I am Claude.',
				event: 'text',
				timestamp: Date.now(),
			})

			// Step 5: Flush outputs (don't destroy - just simulate process stop)
			await manager1.flushOutputs()

			// Step 6: Verify data is in database
			const messagesBeforeRestart = messageRepo.findBySessionId(session.id)
			expect(messagesBeforeRestart).toHaveLength(2)

			const outputsBeforeRestart = outputRepo.findBySessionId(session.id)
			expect(outputsBeforeRestart).toHaveLength(1)

			// Step 7: Create second SessionManager instance (simulate restart)
			const manager2 = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
				messageRepository: messageRepo,
				outputRepository: outputRepo,
			})

			// Step 8: Load sessions
			await manager2.loadSessions()

			// Step 9: Verify session was restored
			const restoredSession = manager2.getSession(session.id)
			expect(restoredSession).toBeDefined()
			expect(restoredSession?.name).toBe('E2E Test Session')

			// Step 10: Verify history is available
			const history = getSessionHistory(session.id, messageRepo, outputRepo)
			expect(history.messages).toHaveLength(2)
			expect(history.messages[0].content).toBe('Hello, this is the first message')
			expect(history.messages[1].content).toBe('This is the second message')
			expect(history.outputs).toHaveLength(1)
			expect(history.outputs[0].content).toBe('Hello! I am Claude.')

			// Cleanup
			await manager2.destroyAll()
		})

		it('should continue most recent session with --continue flag', async () => {
			// Step 1: Create multiple sessions
			const manager = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
				messageRepository: messageRepo,
				outputRepository: outputRepo,
			})

			await manager.createSession({ name: 'Older Session' })
			await new Promise((resolve) => setTimeout(resolve, 100))
			const session2 = await manager.createSession({ name: 'Newer Session' })

			// Ensure session2 has a later updatedAt
			sessionRepo.update({
				...session2,
				updatedAt: new Date(Date.now() + 1000).toISOString(),
			})

			// Add message to newer session
			manager.sendMessage(session2.id, 'Message in newer session')
			await new Promise((resolve) => setTimeout(resolve, 50))

			await manager.flushOutputs()
			// Don't call destroyAll() - sessions should persist

			// Step 2: Use initializeContinueMode to find most recent session
			const continueResult = initializeContinueMode(testDir)

			expect(continueResult.hasHistory).toBe(true)
			expect(continueResult.sessionId).toBe(session2.id)
			expect(continueResult.sessionName).toBe('Newer Session')

			// Cleanup
			await manager.destroyAll()
		})

		it('should maintain data consistency after multiple operations', async () => {
			const manager = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
				messageRepository: messageRepo,
				outputRepository: outputRepo,
			})

			// Create session
			const session = await manager.createSession({ name: 'Consistency Test' })

			// Multiple messages
			for (let i = 0; i < 10; i++) {
				manager.sendMessage(session.id, `Message ${i + 1}`)
				await new Promise((resolve) => setTimeout(resolve, 10))
			}

			// Multiple outputs
			for (let i = 0; i < 5; i++) {
				outputRepo.create({
					sessionId: session.id,
					type: 'parsed',
					content: `Output ${i + 1}`,
					event: 'text',
					timestamp: Date.now() + i,
				})
			}

			await manager.flushOutputs()

			// Verify all data
			const messages = messageRepo.findBySessionId(session.id)
			expect(messages).toHaveLength(10)

			const outputs = outputRepo.findBySessionId(session.id)
			expect(outputs).toHaveLength(5)

			// Verify ordering
			for (let i = 0; i < 10; i++) {
				expect(messages[i].content).toBe(`Message ${i + 1}`)
			}

			await manager.destroyAll()
		})
	})

	describe('edge cases', () => {
		it('should handle empty database gracefully', async () => {
			const result = initializeContinueMode(testDir)

			expect(result.hasHistory).toBe(false)
			expect(result.sessionId).toBeNull()
		})

		it('should handle session with no messages', async () => {
			const manager = new SessionManager({
				dataDir: testDir,
				sessionRepository: sessionRepo,
				messageRepository: messageRepo,
				outputRepository: outputRepo,
			})

			const session = await manager.createSession({ name: 'Empty Session' })

			const history = getSessionHistory(session.id, messageRepo, outputRepo)
			expect(history.messages).toHaveLength(0)
			expect(history.outputs).toHaveLength(0)

			await manager.destroyAll()
		})
	})
})
