import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Session } from '@clauductor/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { type Message, MessageRepository } from '../db/MessageRepository.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'

describe('MessageRepository', () => {
	let testDir: string
	let database: Database
	let messageRepo: MessageRepository
	let sessionRepo: SessionRepository
	let testSession: Session

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-message-repo-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		messageRepo = new MessageRepository(database.db)
		sessionRepo = new SessionRepository(database.db)

		// Create a test session for foreign key constraint
		testSession = {
			id: 'test-session-1',
			name: 'Test Session',
			status: 'idle',
			workingDir: '/tmp',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}
		sessionRepo.create(testSession)
	})

	afterEach(async () => {
		database.close()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('create', () => {
		it('should create a new message', () => {
			const message: Omit<Message, 'id'> = {
				sessionId: testSession.id,
				role: 'user',
				content: 'Hello, Claude!',
				timestamp: Date.now(),
			}

			const id = messageRepo.create(message)

			expect(id).toBeGreaterThan(0)
		})

		it('should store message with correct data', () => {
			const timestamp = Date.now()
			const message: Omit<Message, 'id'> = {
				sessionId: testSession.id,
				role: 'assistant',
				content: 'Hello! How can I help you today?',
				timestamp,
			}

			const id = messageRepo.create(message)
			const messages = messageRepo.findBySessionId(testSession.id)

			expect(messages).toHaveLength(1)
			expect(messages[0].id).toBe(id)
			expect(messages[0].sessionId).toBe(testSession.id)
			expect(messages[0].role).toBe('assistant')
			expect(messages[0].content).toBe('Hello! How can I help you today?')
			expect(messages[0].timestamp).toBe(timestamp)
		})

		it('should throw on invalid session_id (foreign key constraint)', () => {
			const message: Omit<Message, 'id'> = {
				sessionId: 'non-existent-session',
				role: 'user',
				content: 'Test message',
				timestamp: Date.now(),
			}

			expect(() => messageRepo.create(message)).toThrow()
		})
	})

	describe('findBySessionId', () => {
		it('should return all messages for a session', () => {
			const messages: Array<Omit<Message, 'id'>> = [
				{ sessionId: testSession.id, role: 'user', content: 'First', timestamp: 1000 },
				{ sessionId: testSession.id, role: 'assistant', content: 'Second', timestamp: 2000 },
				{ sessionId: testSession.id, role: 'user', content: 'Third', timestamp: 3000 },
			]

			for (const msg of messages) {
				messageRepo.create(msg)
			}

			const found = messageRepo.findBySessionId(testSession.id)

			expect(found).toHaveLength(3)
		})

		it('should return empty array when no messages exist', () => {
			const found = messageRepo.findBySessionId(testSession.id)
			expect(found).toEqual([])
		})

		it('should not return messages from other sessions', () => {
			// Create second session
			const session2: Session = {
				id: 'test-session-2',
				name: 'Second Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}
			sessionRepo.create(session2)

			// Add messages to both sessions
			messageRepo.create({
				sessionId: testSession.id,
				role: 'user',
				content: 'Session 1 message',
				timestamp: 1000,
			})
			messageRepo.create({
				sessionId: session2.id,
				role: 'user',
				content: 'Session 2 message',
				timestamp: 2000,
			})

			const found = messageRepo.findBySessionId(testSession.id)

			expect(found).toHaveLength(1)
			expect(found[0].content).toBe('Session 1 message')
		})
	})

	describe('message ordering', () => {
		it('should return messages ordered by timestamp ascending', () => {
			// Insert messages out of order
			const messages: Array<Omit<Message, 'id'>> = [
				{ sessionId: testSession.id, role: 'user', content: 'Third', timestamp: 3000 },
				{ sessionId: testSession.id, role: 'user', content: 'First', timestamp: 1000 },
				{ sessionId: testSession.id, role: 'assistant', content: 'Second', timestamp: 2000 },
			]

			for (const msg of messages) {
				messageRepo.create(msg)
			}

			const found = messageRepo.findBySessionId(testSession.id)

			expect(found[0].content).toBe('First')
			expect(found[1].content).toBe('Second')
			expect(found[2].content).toBe('Third')
			expect(found[0].timestamp).toBeLessThan(found[1].timestamp)
			expect(found[1].timestamp).toBeLessThan(found[2].timestamp)
		})
	})

	describe('createBatch', () => {
		it('should create multiple messages in a single transaction', () => {
			const messages: Array<Omit<Message, 'id'>> = [
				{ sessionId: testSession.id, role: 'user', content: 'Msg 1', timestamp: 1000 },
				{ sessionId: testSession.id, role: 'assistant', content: 'Msg 2', timestamp: 2000 },
				{ sessionId: testSession.id, role: 'user', content: 'Msg 3', timestamp: 3000 },
			]

			const ids = messageRepo.createBatch(messages)

			expect(ids).toHaveLength(3)
			const found = messageRepo.findBySessionId(testSession.id)
			expect(found).toHaveLength(3)
		})

		it('should return empty array for empty input', () => {
			const ids = messageRepo.createBatch([])
			expect(ids).toEqual([])
		})
	})
})
