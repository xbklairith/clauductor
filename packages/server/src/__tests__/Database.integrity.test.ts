import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkDatabaseIntegrity, createDatabase } from '../db/Database.js'
import { runMigrations } from '../db/migrations/runner.js'

describe('Database Integrity', () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-integrity-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('checkDatabaseIntegrity', () => {
		it('should return ok for a healthy database', () => {
			const database = createDatabase(testDir)
			runMigrations(database.db)

			const result = checkDatabaseIntegrity(database.db)

			expect(result.ok).toBe(true)
			expect(result.message).toBe('ok')

			database.close()
		})

		it('should detect corruption in database', async () => {
			// Create a valid database first
			const database = createDatabase(testDir)
			runMigrations(database.db)
			database.close()

			// Corrupt the database file by writing garbage
			const dbPath = path.join(testDir, 'clauductor.db')
			const content = await fs.readFile(dbPath)
			// Corrupt the middle of the file
			const corrupted = Buffer.concat([
				content.slice(0, 100),
				Buffer.from('CORRUPTED_DATA_HERE'),
				content.slice(119),
			])
			await fs.writeFile(dbPath, corrupted)

			// Try to open the corrupted database
			let result: { ok: boolean; message: string }
			try {
				const corruptDb = createDatabase(testDir)
				result = checkDatabaseIntegrity(corruptDb.db)
				corruptDb.close()
			} catch {
				// If the database can't even be opened, that's also a form of corruption detection
				result = { ok: false, message: 'Failed to open database' }
			}

			expect(result.ok).toBe(false)
		})
	})

	describe('WAL mode recovery', () => {
		it('should enable WAL mode for crash recovery', () => {
			const database = createDatabase(testDir)
			runMigrations(database.db)

			// Check WAL mode is enabled
			const journalMode = database.db.pragma('journal_mode', { simple: true })
			expect(journalMode).toBe('wal')

			database.close()
		})

		it('should checkpoint WAL on close', async () => {
			const database = createDatabase(testDir)
			runMigrations(database.db)

			// Write some data
			database.db.exec("INSERT INTO sessions (id, name, status, working_dir, created_at, updated_at) VALUES ('test', 'Test', 'idle', '/tmp', datetime('now'), datetime('now'))")

			// Close (which checkpoints)
			database.close()

			// Check WAL file is small or doesn't exist (checkpointed)
			const walPath = path.join(testDir, 'clauductor.db-wal')
			let walSize = 0
			try {
				const stat = await fs.stat(walPath)
				walSize = stat.size
			} catch {
				// WAL file might not exist after checkpoint, which is fine
				walSize = 0
			}

			// WAL should be small (< 1KB) after checkpoint
			expect(walSize).toBeLessThan(1024)
		})
	})
})
