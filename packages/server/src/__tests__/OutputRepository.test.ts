import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Session } from '@clauductor/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { type Output, OutputRepository } from '../db/OutputRepository.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'

describe('OutputRepository', () => {
	let testDir: string
	let database: Database
	let outputRepo: OutputRepository
	let sessionRepo: SessionRepository
	let testSession: Session

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-output-repo-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		outputRepo = new OutputRepository(database.db)
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
		it('should create a new output', () => {
			const output: Omit<Output, 'id'> = {
				sessionId: testSession.id,
				type: 'text',
				content: 'Hello, world!',
				event: 'message',
				timestamp: Date.now(),
			}

			const id = outputRepo.create(output)

			expect(id).toBeGreaterThan(0)
		})

		it('should store output with correct data', () => {
			const timestamp = Date.now()
			const output: Omit<Output, 'id'> = {
				sessionId: testSession.id,
				type: 'json',
				content: '{"key": "value"}',
				event: 'tool_use',
				timestamp,
			}

			const id = outputRepo.create(output)
			const outputs = outputRepo.findBySessionId(testSession.id)

			expect(outputs).toHaveLength(1)
			expect(outputs[0].id).toBe(id)
			expect(outputs[0].sessionId).toBe(testSession.id)
			expect(outputs[0].type).toBe('json')
			expect(outputs[0].content).toBe('{"key": "value"}')
			expect(outputs[0].event).toBe('tool_use')
			expect(outputs[0].timestamp).toBe(timestamp)
		})

		it('should allow null event', () => {
			const output: Omit<Output, 'id'> = {
				sessionId: testSession.id,
				type: 'text',
				content: 'Output without event',
				event: null,
				timestamp: Date.now(),
			}

			outputRepo.create(output)
			const outputs = outputRepo.findBySessionId(testSession.id)

			expect(outputs).toHaveLength(1)
			expect(outputs[0].event).toBeNull()
		})

		it('should throw on invalid session_id (foreign key constraint)', () => {
			const output: Omit<Output, 'id'> = {
				sessionId: 'non-existent-session',
				type: 'text',
				content: 'Test output',
				event: null,
				timestamp: Date.now(),
			}

			expect(() => outputRepo.create(output)).toThrow()
		})
	})

	describe('findBySessionId', () => {
		it('should return all outputs for a session', () => {
			const outputs: Array<Omit<Output, 'id'>> = [
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'First',
					event: 'message',
					timestamp: 1000,
				},
				{
					sessionId: testSession.id,
					type: 'json',
					content: '{}',
					event: 'tool_use',
					timestamp: 2000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Third',
					event: null,
					timestamp: 3000,
				},
			]

			for (const output of outputs) {
				outputRepo.create(output)
			}

			const found = outputRepo.findBySessionId(testSession.id)

			expect(found).toHaveLength(3)
		})

		it('should return empty array when no outputs exist', () => {
			const found = outputRepo.findBySessionId(testSession.id)
			expect(found).toEqual([])
		})

		it('should not return outputs from other sessions', () => {
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

			// Add outputs to both sessions
			outputRepo.create({
				sessionId: testSession.id,
				type: 'text',
				content: 'Session 1 output',
				event: null,
				timestamp: 1000,
			})
			outputRepo.create({
				sessionId: session2.id,
				type: 'text',
				content: 'Session 2 output',
				event: null,
				timestamp: 2000,
			})

			const found = outputRepo.findBySessionId(testSession.id)

			expect(found).toHaveLength(1)
			expect(found[0].content).toBe('Session 1 output')
		})

		it('should return outputs ordered by timestamp ascending', () => {
			// Insert outputs out of order
			const outputs: Array<Omit<Output, 'id'>> = [
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Third',
					event: null,
					timestamp: 3000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'First',
					event: null,
					timestamp: 1000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Second',
					event: null,
					timestamp: 2000,
				},
			]

			for (const output of outputs) {
				outputRepo.create(output)
			}

			const found = outputRepo.findBySessionId(testSession.id)

			expect(found[0].content).toBe('First')
			expect(found[1].content).toBe('Second')
			expect(found[2].content).toBe('Third')
		})
	})

	describe('findByType', () => {
		it('should filter outputs by type', () => {
			const outputs: Array<Omit<Output, 'id'>> = [
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Text 1',
					event: null,
					timestamp: 1000,
				},
				{
					sessionId: testSession.id,
					type: 'json',
					content: '{}',
					event: null,
					timestamp: 2000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Text 2',
					event: null,
					timestamp: 3000,
				},
			]

			for (const output of outputs) {
				outputRepo.create(output)
			}

			const textOutputs = outputRepo.findByType(testSession.id, 'text')
			const jsonOutputs = outputRepo.findByType(testSession.id, 'json')

			expect(textOutputs).toHaveLength(2)
			expect(jsonOutputs).toHaveLength(1)
		})
	})

	describe('createBatch', () => {
		it('should create multiple outputs in a single transaction', () => {
			const outputs: Array<Omit<Output, 'id'>> = [
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Batch 1',
					event: null,
					timestamp: 1000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Batch 2',
					event: null,
					timestamp: 2000,
				},
				{
					sessionId: testSession.id,
					type: 'text',
					content: 'Batch 3',
					event: null,
					timestamp: 3000,
				},
			]

			const ids = outputRepo.createBatch(outputs)

			expect(ids).toHaveLength(3)
			const found = outputRepo.findBySessionId(testSession.id)
			expect(found).toHaveLength(3)
		})

		it('should return empty array for empty input', () => {
			const ids = outputRepo.createBatch([])
			expect(ids).toEqual([])
		})
	})

	describe('deleteBySessionId', () => {
		it('should delete all outputs for a session', () => {
			// Add some outputs
			outputRepo.create({
				sessionId: testSession.id,
				type: 'text',
				content: 'To be deleted',
				event: null,
				timestamp: 1000,
			})
			outputRepo.create({
				sessionId: testSession.id,
				type: 'text',
				content: 'Also deleted',
				event: null,
				timestamp: 2000,
			})

			const deletedCount = outputRepo.deleteBySessionId(testSession.id)

			expect(deletedCount).toBe(2)
			expect(outputRepo.findBySessionId(testSession.id)).toHaveLength(0)
		})

		it('should not delete outputs from other sessions', () => {
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

			outputRepo.create({
				sessionId: testSession.id,
				type: 'text',
				content: 'Session 1',
				event: null,
				timestamp: 1000,
			})
			outputRepo.create({
				sessionId: session2.id,
				type: 'text',
				content: 'Session 2',
				event: null,
				timestamp: 2000,
			})

			outputRepo.deleteBySessionId(testSession.id)

			expect(outputRepo.findBySessionId(testSession.id)).toHaveLength(0)
			expect(outputRepo.findBySessionId(session2.id)).toHaveLength(1)
		})
	})
})
