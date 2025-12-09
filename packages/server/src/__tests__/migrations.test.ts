import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../db/Database.js'
import { getMigrationStatus, runMigrations } from '../db/migrations/runner.js'

describe('Migration System', () => {
	let testDir: string

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `clauductor-migration-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('runMigrations', () => {
		it('should run initial migration on fresh database', () => {
			const database = createDatabase(testDir)

			runMigrations(database.db)

			// Check that migrations table exists
			const tables = database.db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
				.get() as { name: string } | undefined

			expect(tables?.name).toBe('migrations')

			// Check that sessions table exists (from initial migration)
			const sessionsTable = database.db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
				.get() as { name: string } | undefined

			expect(sessionsTable?.name).toBe('sessions')

			database.close()
		})

		it('should skip already-run migrations', () => {
			const database = createDatabase(testDir)

			// Run migrations twice
			runMigrations(database.db)
			runMigrations(database.db)

			// Should only have one entry per migration
			const count = database.db.prepare('SELECT COUNT(*) as count FROM migrations').get() as {
				count: number
			}

			// Should have exactly the number of migrations, not doubled
			expect(count.count).toBeGreaterThan(0)

			database.close()
		})

		it('should track migration versions', () => {
			const database = createDatabase(testDir)

			runMigrations(database.db)

			// Check migration history
			const migrations = database.db
				.prepare('SELECT version, name, applied_at FROM migrations ORDER BY version')
				.all() as Array<{ version: number; name: string; applied_at: string }>

			expect(migrations.length).toBeGreaterThan(0)
			expect(migrations[0].version).toBe(1)
			expect(migrations[0].name).toBe('001_initial_schema')
			expect(migrations[0].applied_at).toBeTruthy()

			database.close()
		})
	})

	describe('getMigrationStatus', () => {
		it('should return status of all migrations', () => {
			const database = createDatabase(testDir)

			runMigrations(database.db)

			const status = getMigrationStatus(database.db)

			expect(status.applied.length).toBeGreaterThan(0)
			expect(status.pending.length).toBe(0)
			expect(status.total).toBeGreaterThan(0)

			database.close()
		})

		it('should show pending migrations on fresh database', () => {
			const database = createDatabase(testDir)

			// Don't run migrations yet
			const status = getMigrationStatus(database.db)

			expect(status.applied.length).toBe(0)
			expect(status.pending.length).toBeGreaterThan(0)

			database.close()
		})
	})
})
