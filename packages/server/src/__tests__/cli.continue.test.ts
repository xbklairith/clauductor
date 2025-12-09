import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'
import { findMostRecentSession, initializeContinueMode } from '../utils/continueMode.js'

describe('--continue flag functionality', () => {
	let testDir: string
	let database: Database
	let sessionRepo: SessionRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-continue-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		sessionRepo = new SessionRepository(database.db)
	})

	afterEach(async () => {
		database.close()
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('findMostRecentSession', () => {
		it('should return the most recent session when sessions exist', () => {
			// Create multiple sessions with different timestamps
			sessionRepo.create({
				id: 'session-1',
				name: 'Older Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			})
			sessionRepo.create({
				id: 'session-2',
				name: 'Newest Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-02T00:00:00.000Z',
				updatedAt: '2025-01-03T00:00:00.000Z',
			})
			sessionRepo.create({
				id: 'session-3',
				name: 'Middle Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01T12:00:00.000Z',
				updatedAt: '2025-01-02T00:00:00.000Z',
			})

			const mostRecent = findMostRecentSession(sessionRepo)

			expect(mostRecent).not.toBeNull()
			expect(mostRecent?.id).toBe('session-2')
			expect(mostRecent?.name).toBe('Newest Session')
		})

		it('should return null when no sessions exist', () => {
			const mostRecent = findMostRecentSession(sessionRepo)
			expect(mostRecent).toBeNull()
		})

		it('should exclude soft-deleted sessions', () => {
			sessionRepo.create({
				id: 'deleted-session',
				name: 'Deleted Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-02T00:00:00.000Z',
				updatedAt: '2025-01-03T00:00:00.000Z',
			})
			sessionRepo.create({
				id: 'active-session',
				name: 'Active Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			})

			// Soft delete the newer session
			sessionRepo.delete('deleted-session')

			const mostRecent = findMostRecentSession(sessionRepo)

			expect(mostRecent).not.toBeNull()
			expect(mostRecent?.id).toBe('active-session')
		})
	})

	describe('initializeContinueMode', () => {
		it('should return session info when sessions exist', () => {
			sessionRepo.create({
				id: 'existing-session',
				name: 'Existing Session',
				status: 'idle',
				workingDir: '/home/user/project',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T00:00:00.000Z',
			})

			const result = initializeContinueMode(testDir)

			expect(result.sessionId).toBe('existing-session')
			expect(result.sessionName).toBe('Existing Session')
			expect(result.hasHistory).toBe(true)
		})

		it('should return null sessionId when no sessions exist', () => {
			const result = initializeContinueMode(testDir)

			expect(result.sessionId).toBeNull()
			expect(result.hasHistory).toBe(false)
		})
	})
})
