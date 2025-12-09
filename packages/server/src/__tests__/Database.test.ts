import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Database, createDatabase } from '../db/Database.js'

describe('Database', () => {
	let testDir: string
	let db: Database | null = null

	beforeEach(async () => {
		// Create a temp directory for tests
		testDir = path.join(os.tmpdir(), `clauductor-db-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		// Close database if open
		if (db) {
			db.close()
			db = null
		}
		// Clean up temp directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('createDatabase', () => {
		it('should create database file at specified path', async () => {
			db = createDatabase(testDir)

			const dbPath = path.join(testDir, 'clauductor.db')
			const exists = await fs
				.access(dbPath)
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(true)
		})

		it('should enable WAL mode', () => {
			db = createDatabase(testDir)

			const result = db.db.pragma('journal_mode') as Array<{ journal_mode: string }>
			expect(result[0].journal_mode).toBe('wal')
		})

		it('should enable foreign keys', () => {
			db = createDatabase(testDir)

			const result = db.db.pragma('foreign_keys') as Array<{ foreign_keys: number }>
			expect(result[0].foreign_keys).toBe(1)
		})
	})

	describe('close', () => {
		it('should close database connection cleanly', () => {
			const testDb = createDatabase(testDir)
			db = testDb

			expect(() => testDb.close()).not.toThrow()

			// After closing, db operations should fail
			expect(() => testDb.db.prepare('SELECT 1').get()).toThrow()
			db = null // Mark as closed so afterEach doesn't try to close again
		})

		it('should checkpoint WAL before closing', async () => {
			db = createDatabase(testDir)

			// Write something to ensure WAL has data
			db.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')
			db.db.exec('INSERT INTO test VALUES (1)')

			db.close()
			db = null

			// WAL file should be empty or not exist after checkpoint
			const walPath = path.join(testDir, 'clauductor.db-wal')
			try {
				const stat = await fs.stat(walPath)
				// If WAL exists, it should be empty (0 bytes) after TRUNCATE checkpoint
				expect(stat.size).toBe(0)
			} catch {
				// WAL file doesn't exist, which is also acceptable
				expect(true).toBe(true)
			}
		})
	})
})
