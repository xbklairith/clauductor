import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Session } from '@clauductor/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'

describe('SessionRepository', () => {
	let testDir: string
	let database: Database
	let repo: SessionRepository

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-session-repo-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
		database = createDatabase(testDir)
		runMigrations(database.db)
		repo = new SessionRepository(database.db)
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
		it('should create a new session', () => {
			const session: Session = {
				id: 'test-id-1',
				name: 'Test Session',
				status: 'idle',
				workingDir: '/home/user/project',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			repo.create(session)

			const found = repo.findById('test-id-1')
			expect(found).not.toBeNull()
			expect(found?.id).toBe('test-id-1')
			expect(found?.name).toBe('Test Session')
			expect(found?.status).toBe('idle')
			expect(found?.workingDir).toBe('/home/user/project')
		})

		it('should throw on duplicate id', () => {
			const session: Session = {
				id: 'duplicate-id',
				name: 'Test Session',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			repo.create(session)

			expect(() => repo.create(session)).toThrow()
		})
	})

	describe('update', () => {
		it('should update an existing session', () => {
			const session: Session = {
				id: 'update-test',
				name: 'Original Name',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			repo.create(session)

			const updated: Session = {
				...session,
				name: 'Updated Name',
				status: 'running',
				updatedAt: new Date().toISOString(),
			}

			repo.update(updated)

			const found = repo.findById('update-test')
			expect(found?.name).toBe('Updated Name')
			expect(found?.status).toBe('running')
		})
	})

	describe('findById', () => {
		it('should return session when found', () => {
			const session: Session = {
				id: 'find-test',
				name: 'Find Test',
				status: 'running',
				workingDir: '/home',
				createdAt: '2025-01-01T00:00:00.000Z',
				updatedAt: '2025-01-01T01:00:00.000Z',
			}

			repo.create(session)

			const found = repo.findById('find-test')

			expect(found).not.toBeNull()
			expect(found?.id).toBe('find-test')
			expect(found?.createdAt).toBe('2025-01-01T00:00:00.000Z')
		})

		it('should return null when not found', () => {
			const found = repo.findById('non-existent')
			expect(found).toBeNull()
		})
	})

	describe('findAll', () => {
		it('should return all sessions', () => {
			const sessions: Session[] = [
				{
					id: 'session-1',
					name: 'Session 1',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
				{
					id: 'session-2',
					name: 'Session 2',
					status: 'running',
					workingDir: '/home',
					createdAt: '2025-01-02T00:00:00.000Z',
					updatedAt: '2025-01-02T00:00:00.000Z',
				},
			]

			for (const session of sessions) {
				repo.create(session)
			}

			const found = repo.findAll()

			expect(found).toHaveLength(2)
			expect(found.map((s) => s.id).sort()).toEqual(['session-1', 'session-2'])
		})

		it('should return empty array when no sessions', () => {
			const found = repo.findAll()
			expect(found).toEqual([])
		})

		it('should return sessions sorted by updatedAt desc', () => {
			const sessions: Session[] = [
				{
					id: 'old-session',
					name: 'Old Session',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
				{
					id: 'new-session',
					name: 'New Session',
					status: 'running',
					workingDir: '/home',
					createdAt: '2025-01-02T00:00:00.000Z',
					updatedAt: '2025-01-02T00:00:00.000Z',
				},
			]

			for (const session of sessions) {
				repo.create(session)
			}

			const found = repo.findAll()

			expect(found[0].id).toBe('new-session')
			expect(found[1].id).toBe('old-session')
		})
	})

	describe('delete', () => {
		it('should soft delete a session by setting deleted_at', () => {
			const session: Session = {
				id: 'delete-test',
				name: 'Delete Test',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			repo.create(session)
			repo.delete('delete-test')

			// Should not be found via findById
			const found = repo.findById('delete-test')
			expect(found).toBeNull()
		})

		it('should exclude deleted sessions from findAll', () => {
			const sessions: Session[] = [
				{
					id: 'keep-session',
					name: 'Keep Session',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
				{
					id: 'delete-session',
					name: 'Delete Session',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			]

			for (const session of sessions) {
				repo.create(session)
			}

			repo.delete('delete-session')

			const found = repo.findAll()
			expect(found).toHaveLength(1)
			expect(found[0].id).toBe('keep-session')
		})
	})

	describe('findMostRecent', () => {
		it('should return the most recently updated session', () => {
			const sessions: Session[] = [
				{
					id: 'older-session',
					name: 'Older Session',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
				{
					id: 'newest-session',
					name: 'Newest Session',
					status: 'running',
					workingDir: '/home',
					createdAt: '2025-01-02T00:00:00.000Z',
					updatedAt: '2025-01-03T00:00:00.000Z',
				},
				{
					id: 'middle-session',
					name: 'Middle Session',
					status: 'idle',
					workingDir: '/var',
					createdAt: '2025-01-02T00:00:00.000Z',
					updatedAt: '2025-01-02T00:00:00.000Z',
				},
			]

			for (const session of sessions) {
				repo.create(session)
			}

			const mostRecent = repo.findMostRecent()

			expect(mostRecent).not.toBeNull()
			expect(mostRecent?.id).toBe('newest-session')
		})

		it('should return null when no sessions exist', () => {
			const mostRecent = repo.findMostRecent()
			expect(mostRecent).toBeNull()
		})

		it('should exclude deleted sessions', () => {
			const sessions: Session[] = [
				{
					id: 'older-active',
					name: 'Older Active',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
				},
				{
					id: 'newest-but-deleted',
					name: 'Newest But Deleted',
					status: 'idle',
					workingDir: '/home',
					createdAt: '2025-01-02T00:00:00.000Z',
					updatedAt: '2025-01-03T00:00:00.000Z',
				},
			]

			for (const session of sessions) {
				repo.create(session)
			}

			repo.delete('newest-but-deleted')

			const mostRecent = repo.findMostRecent()

			expect(mostRecent).not.toBeNull()
			expect(mostRecent?.id).toBe('older-active')
		})
	})
})
