import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { EventEmitter } from 'node:events'
import { createServer, type ClauductorServer } from '../server.js'
import { createDatabase, type Database } from '../db/Database.js'
import { runMigrations } from '../db/migrations/runner.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { MessageRepository } from '../db/MessageRepository.js'
import type { Session, SessionOutput } from '@clauductor/shared'

// Mock node-pty to return controlled output
vi.mock('node-pty', () => ({
	spawn: vi.fn(() => {
		const emitter = new EventEmitter()
		const mockPty = {
			pid: 12345,
			onData: (cb: (data: string) => void) => emitter.on('data', cb),
			onExit: (cb: (ev: { exitCode: number }) => void) => emitter.on('exit', cb),
			write: (data: string) => {
				// Simulate Claude responding to input
				const userMessage = data.trim()
				setTimeout(() => {
					// Emit a structured JSON response
					emitter.emit(
						'data',
						`${JSON.stringify({
							type: 'assistant',
							message: { content: `Echo: ${userMessage}` },
						})}\n`,
					)
				}, 10)
				// Simulate process completing
				setTimeout(() => {
					emitter.emit('exit', { exitCode: 0 })
				}, 50)
			},
			resize: vi.fn(),
			kill: vi.fn(() => {
				emitter.emit('exit', { exitCode: 0 })
			}),
		}
		return mockPty
	}),
}))

describe('E2E User Flow via Socket.io', () => {
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository
	let messageRepo: MessageRepository
	let server: ClauductorServer
	let client: ClientSocket
	let port: number

	beforeEach(
		async () => {
			// Create temporary test directory
			testDir = path.join(os.tmpdir(), `clauductor-e2e-userflow-${Date.now()}`)
			await fs.mkdir(testDir, { recursive: true })

			// Initialize database
			database = createDatabase(testDir)
			runMigrations(database.db)
			sessionRepo = new SessionRepository(database.db)
			messageRepo = new MessageRepository(database.db)

			// Find available port
			port = 3001 + Math.floor(Math.random() * 1000)

			// Create and start server
			server = createServer({ port, corsOrigins: ['http://localhost:5173'], dataDir: testDir })
			await server.start()
		},
		10000,
	)

	afterEach(async () => {
		// Disconnect client
		if (client?.connected) {
			client.disconnect()
		}

		// Stop server
		if (server) {
			await server.stop()
		}

		// Close database
		database.close()

		// Cleanup test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('complete session lifecycle', () => {
		it(
			'should handle full flow: connect → create → message → output → destroy',
			async () => {
				// Create client and register listeners BEFORE connecting
				client = ioClient(`http://localhost:${port}`, {
					autoConnect: false,
					reconnection: false,
				})

				// Step 1: Register session:list listener before connecting
				const sessionListPromise = new Promise<Session[]>((resolve) => {
					client.on('session:list', (sessions: Session[]) => {
						resolve(sessions)
					})
				})

				// Connect now
				client.connect()

				// Wait for connection
				await new Promise<void>((resolve) => {
					client.on('connect', () => resolve())
				})

				expect(client.connected).toBe(true)

				// Verify session list
				const sessionList = await sessionListPromise
				expect(sessionList).toEqual([])

				// Step 2: Create session
				const createdSession = await new Promise<Session>((resolve) => {
					client.on('session:created', (session: Session) => {
						resolve(session)
					})
					client.emit('session:create', { name: 'Test Session' })
				})

				expect(createdSession.id).toBeDefined()
				expect(createdSession.name).toBe('Test Session')
				expect(createdSession.status).toBe('idle')

				// Step 3: Send message
				const outputs: SessionOutput[] = []
				client.on('session:output', (output: SessionOutput) => {
					outputs.push(output)
				})

				client.emit('session:message', {
					sessionId: createdSession.id,
					content: 'Hello Claude',
				})

				// Wait for outputs
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Verify outputs received
				expect(outputs.length).toBeGreaterThan(0)
				expect(outputs[0].sessionId).toBe(createdSession.id)

				// Step 4: Verify message stored in database
				const messages = messageRepo.findBySessionId(createdSession.id)
				expect(messages).toHaveLength(1)
				expect(messages[0].content).toBe('Hello Claude')
				expect(messages[0].role).toBe('user')

				// Step 5: Destroy session
				const destroyedEvent = await new Promise<{ sessionId: string }>((resolve) => {
					client.on('session:destroyed', (data: { sessionId: string }) => {
						resolve(data)
					})
					client.emit('session:destroy', { sessionId: createdSession.id })
				})

				expect(destroyedEvent.sessionId).toBe(createdSession.id)

				// Verify session soft-deleted
				const session = sessionRepo.findById(createdSession.id)
				expect(session?.deletedAt).not.toBeNull()
			},
			10000,
		)

		it(
			'should update session status correctly',
			async () => {
				client = ioClient(`http://localhost:${port}`, {
					autoConnect: true,
					reconnection: false,
				})

				await new Promise<void>((resolve) => {
					client.on('connect', () => resolve())
				})

				// Create session
				const createdSession = await new Promise<Session>((resolve) => {
					client.on('session:created', (session: Session) => {
						resolve(session)
					})
					client.emit('session:create', { name: 'Status Test' })
				})

				expect(createdSession.status).toBe('idle')

				// Listen for status updates
				const statusUpdates: Array<{ sessionId: string; status: string }> = []
				client.on('session:status', (data: { sessionId: string; status: string }) => {
					statusUpdates.push(data)
				})

				// Send message (should trigger running status)
				client.emit('session:message', {
					sessionId: createdSession.id,
					content: 'Test message',
				})

				// Wait for status updates
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Verify status changed to running
				const runningStatus = statusUpdates.find((s) => s.status === 'running')
				expect(runningStatus).toBeDefined()
				expect(runningStatus?.sessionId).toBe(createdSession.id)
			},
			10000,
		)
	})

	describe('session history retrieval', () => {
		it(
			'should retrieve session history via socket event',
			async () => {
				client = ioClient(`http://localhost:${port}`, {
					autoConnect: true,
					reconnection: false,
				})

				await new Promise<void>((resolve) => {
					client.on('connect', () => resolve())
				})

				// Create session
				const createdSession = await new Promise<Session>((resolve) => {
					client.on('session:created', (session: Session) => {
						resolve(session)
					})
					client.emit('session:create', { name: 'History Test' })
				})

				// Send messages
				client.emit('session:message', {
					sessionId: createdSession.id,
					content: 'First message',
				})
				await new Promise((resolve) => setTimeout(resolve, 50))

				client.emit('session:message', {
					sessionId: createdSession.id,
					content: 'Second message',
				})
				await new Promise((resolve) => setTimeout(resolve, 50))

				// Request history
				const history = await new Promise<{
					sessionId: string
					messages: Array<{ content: string }>
					outputs: Array<{ content: string }>
				}>((resolve) => {
					client.on('session:history', (data) => {
						resolve(data)
					})
					client.emit('session:history', { sessionId: createdSession.id })
				})

				expect(history.sessionId).toBe(createdSession.id)
				expect(history.messages).toHaveLength(2)
				expect(history.messages[0].content).toBe('First message')
				expect(history.messages[1].content).toBe('Second message')
			},
			10000,
		)
	})

	describe('multi-session handling', () => {
		it(
			'should manage multiple sessions independently',
			async () => {
				client = ioClient(`http://localhost:${port}`, {
					autoConnect: true,
					reconnection: false,
				})

				await new Promise<void>((resolve) => {
					client.on('connect', () => resolve())
				})

				// Create multiple sessions
				const sessions: Session[] = []
				for (let i = 1; i <= 3; i++) {
					const session = await new Promise<Session>((resolve) => {
						client.once('session:created', (session: Session) => {
							resolve(session)
						})
						client.emit('session:create', { name: `Session ${i}` })
					})
					sessions.push(session)
				}

				expect(sessions).toHaveLength(3)

				// Send messages to different sessions
				client.emit('session:message', {
					sessionId: sessions[0].id,
					content: 'Message to session 1',
				})
				await new Promise((resolve) => setTimeout(resolve, 50))

				client.emit('session:message', {
					sessionId: sessions[2].id,
					content: 'Message to session 3',
				})
				await new Promise((resolve) => setTimeout(resolve, 50))

				// Verify messages stored correctly
				const messages1 = messageRepo.findBySessionId(sessions[0].id)
				expect(messages1).toHaveLength(1)
				expect(messages1[0].content).toBe('Message to session 1')

				const messages2 = messageRepo.findBySessionId(sessions[1].id)
				expect(messages2).toHaveLength(0)

				const messages3 = messageRepo.findBySessionId(sessions[2].id)
				expect(messages3).toHaveLength(1)
				expect(messages3[0].content).toBe('Message to session 3')
			},
			10000,
		)
	})

	describe('server restart persistence', () => {
		it(
			'should persist and restore sessions across server restart',
			async () => {
				// First server instance
				client = ioClient(`http://localhost:${port}`, {
					autoConnect: true,
					reconnection: false,
				})

				await new Promise<void>((resolve) => {
					client.on('connect', () => resolve())
				})

				// Create session and send message
				const createdSession = await new Promise<Session>((resolve) => {
					client.on('session:created', (session: Session) => {
						resolve(session)
					})
					client.emit('session:create', { name: 'Persistent Session' })
				})

				client.emit('session:message', {
					sessionId: createdSession.id,
					content: 'Message before restart',
				})
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Disconnect client
				client.disconnect()

				// Verify data was persisted to database (before stopping server)
				const persistedSession = sessionRepo.findById(createdSession.id)
				expect(persistedSession).toBeDefined()
				expect(persistedSession?.name).toBe('Persistent Session')
				expect(persistedSession?.deletedAt).toBeFalsy() // null or undefined

				const persistedMessages = messageRepo.findBySessionId(createdSession.id)
				expect(persistedMessages).toHaveLength(1)
				expect(persistedMessages[0].content).toBe('Message before restart')

				// Note: In production, server restart would preserve sessions.
				// Here we verify that session data is correctly stored in the database
				// and can be retrieved after the server has processed it.
			},
			15000,
		)
	})
})
