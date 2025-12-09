import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { MessageRepository } from '../db/MessageRepository.js'
import { OutputRepository } from '../db/OutputRepository.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'
import { getSessionHistory } from '../utils/history.js'

describe('Session History', () => {
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository
	let messageRepo: MessageRepository
	let outputRepo: OutputRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-history-test-${Date.now()}`)
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

	describe('getSessionHistory', () => {
		it('should return messages for a session', () => {
			// Create session
			sessionRepo.create({
				id: 'session-1',
				name: 'Test Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Create messages
			messageRepo.create({
				sessionId: 'session-1',
				role: 'user',
				content: 'Hello Claude',
				timestamp: 1000,
			})
			messageRepo.create({
				sessionId: 'session-1',
				role: 'assistant',
				content: 'Hello! How can I help?',
				timestamp: 2000,
			})

			const history = getSessionHistory('session-1', messageRepo, outputRepo)

			expect(history.messages).toHaveLength(2)
			expect(history.messages[0].role).toBe('user')
			expect(history.messages[0].content).toBe('Hello Claude')
			expect(history.messages[1].role).toBe('assistant')
			expect(history.messages[1].content).toBe('Hello! How can I help?')
		})

		it('should return outputs for a session', () => {
			// Create session
			sessionRepo.create({
				id: 'session-2',
				name: 'Output Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Create outputs
			outputRepo.create({
				sessionId: 'session-2',
				type: 'raw',
				content: 'Processing...',
				event: null,
				timestamp: 1000,
			})
			outputRepo.create({
				sessionId: 'session-2',
				type: 'parsed',
				content: '{"type":"text","content":"Done"}',
				event: 'text',
				timestamp: 2000,
			})

			const history = getSessionHistory('session-2', messageRepo, outputRepo)

			expect(history.outputs).toHaveLength(2)
			expect(history.outputs[0].type).toBe('raw')
			expect(history.outputs[0].content).toBe('Processing...')
			expect(history.outputs[1].type).toBe('parsed')
		})

		it('should return empty arrays for non-existent session', () => {
			const history = getSessionHistory('non-existent', messageRepo, outputRepo)

			expect(history.messages).toEqual([])
			expect(history.outputs).toEqual([])
		})

		it('should return messages and outputs ordered by timestamp', () => {
			sessionRepo.create({
				id: 'session-3',
				name: 'Ordering Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Create in non-chronological order
			messageRepo.create({
				sessionId: 'session-3',
				role: 'user',
				content: 'Second message',
				timestamp: 2000,
			})
			messageRepo.create({
				sessionId: 'session-3',
				role: 'user',
				content: 'First message',
				timestamp: 1000,
			})

			const history = getSessionHistory('session-3', messageRepo, outputRepo)

			expect(history.messages[0].content).toBe('First message')
			expect(history.messages[1].content).toBe('Second message')
		})

		it('should separate user and assistant messages correctly', () => {
			sessionRepo.create({
				id: 'session-4',
				name: 'Role Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			messageRepo.create({
				sessionId: 'session-4',
				role: 'user',
				content: 'User says hello',
				timestamp: 1000,
			})
			messageRepo.create({
				sessionId: 'session-4',
				role: 'assistant',
				content: 'Assistant responds',
				timestamp: 2000,
			})
			messageRepo.create({
				sessionId: 'session-4',
				role: 'user',
				content: 'User asks question',
				timestamp: 3000,
			})

			const history = getSessionHistory('session-4', messageRepo, outputRepo)

			expect(history.messages).toHaveLength(3)
			expect(history.messages[0].role).toBe('user')
			expect(history.messages[1].role).toBe('assistant')
			expect(history.messages[2].role).toBe('user')
		})
	})
})
