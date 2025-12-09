import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { MessageRepository } from '../db/MessageRepository.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'

describe('Performance Benchmarks', () => {
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository
	let messageRepo: MessageRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-perf-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		sessionRepo = new SessionRepository(database.db)
		messageRepo = new MessageRepository(database.db)
	})

	afterEach(async () => {
		database.close()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('session loading performance', () => {
		it('should load 1000 sessions in under 100ms', () => {
			// Create 1000 sessions
			const sessions = []
			for (let i = 0; i < 1000; i++) {
				sessions.push({
					id: `session-${i}`,
					name: `Test Session ${i}`,
					status: 'idle' as const,
					workingDir: '/tmp',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
			}

			// Insert sessions
			for (const session of sessions) {
				sessionRepo.create(session)
			}

			// Benchmark loading
			const startTime = performance.now()
			const loadedSessions = sessionRepo.findAll()
			const endTime = performance.now()
			const loadTime = endTime - startTime

			expect(loadedSessions).toHaveLength(1000)
			expect(loadTime).toBeLessThan(100) // Should load in under 100ms

			console.log(`Loaded 1000 sessions in ${loadTime.toFixed(2)}ms`)
		})

		it('should find most recent session efficiently with many sessions', () => {
			// Create 1000 sessions with varying timestamps
			for (let i = 0; i < 1000; i++) {
				sessionRepo.create({
					id: `session-${i}`,
					name: `Test Session ${i}`,
					status: 'idle',
					workingDir: '/tmp',
					createdAt: new Date(Date.now() - i * 1000).toISOString(),
					updatedAt: new Date(Date.now() - i * 1000).toISOString(),
				})
			}

			// Benchmark finding most recent
			const startTime = performance.now()
			const mostRecent = sessionRepo.findMostRecent()
			const endTime = performance.now()
			const findTime = endTime - startTime

			expect(mostRecent).not.toBeNull()
			expect(mostRecent?.id).toBe('session-0') // Most recent
			expect(findTime).toBeLessThan(50) // Should find in under 50ms

			console.log(`Found most recent session in ${findTime.toFixed(2)}ms`)
		})
	})

	describe('message insert performance', () => {
		it('should insert a message in under 50ms', () => {
			// Create a session first
			sessionRepo.create({
				id: 'perf-session',
				name: 'Performance Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Benchmark single message insert
			const startTime = performance.now()
			messageRepo.create({
				sessionId: 'perf-session',
				role: 'user',
				content: 'Test message content',
				timestamp: Date.now(),
			})
			const endTime = performance.now()
			const insertTime = endTime - startTime

			expect(insertTime).toBeLessThan(50) // Should insert in under 50ms

			console.log(`Inserted single message in ${insertTime.toFixed(2)}ms`)
		})

		it('should batch insert 100 messages efficiently', () => {
			// Create a session first
			sessionRepo.create({
				id: 'batch-session',
				name: 'Batch Performance Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Prepare 100 messages
			const messages = []
			for (let i = 0; i < 100; i++) {
				messages.push({
					sessionId: 'batch-session',
					role: 'user' as const,
					content: `Message ${i}`,
					timestamp: Date.now() + i,
				})
			}

			// Benchmark batch insert
			const startTime = performance.now()
			messageRepo.createBatch(messages)
			const endTime = performance.now()
			const batchTime = endTime - startTime

			expect(batchTime).toBeLessThan(100) // Should insert 100 in under 100ms

			// Verify all messages inserted
			const loaded = messageRepo.findBySessionId('batch-session')
			expect(loaded).toHaveLength(100)

			console.log(`Batch inserted 100 messages in ${batchTime.toFixed(2)}ms`)
		})
	})

	describe('message retrieval performance', () => {
		it('should retrieve 1000 messages in under 100ms', () => {
			// Create a session
			sessionRepo.create({
				id: 'retrieval-session',
				name: 'Retrieval Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})

			// Insert 1000 messages
			const messages = []
			for (let i = 0; i < 1000; i++) {
				messages.push({
					sessionId: 'retrieval-session',
					role: (i % 2 === 0 ? 'user' : 'assistant') as const,
					content: `Message content ${i}`,
					timestamp: Date.now() + i,
				})
			}
			messageRepo.createBatch(messages)

			// Benchmark retrieval
			const startTime = performance.now()
			const loadedMessages = messageRepo.findBySessionId('retrieval-session')
			const endTime = performance.now()
			const retrieveTime = endTime - startTime

			expect(loadedMessages).toHaveLength(1000)
			expect(retrieveTime).toBeLessThan(100) // Should retrieve in under 100ms

			console.log(`Retrieved 1000 messages in ${retrieveTime.toFixed(2)}ms`)
		})
	})
})
