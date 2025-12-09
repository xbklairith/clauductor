import type BetterSqlite3 from 'better-sqlite3'
import { migration as migration001 } from './001_initial_schema.js'

/**
 * Migration definition structure.
 */
interface Migration {
	version: number
	name: string
	sql: string
}

/**
 * All available migrations in order.
 */
const migrations: Migration[] = [migration001]

/**
 * Migration status information.
 */
export interface MigrationStatus {
	applied: Array<{ version: number; name: string; applied_at: string }>
	pending: Array<{ version: number; name: string }>
	total: number
}

/**
 * Ensure the migrations table exists.
 */
function ensureMigrationsTable(db: BetterSqlite3.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			version INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL
		)
	`)
}

/**
 * Get the set of already-applied migration versions.
 */
function getAppliedVersions(db: BetterSqlite3.Database): Set<number> {
	const rows = db.prepare('SELECT version FROM migrations').all() as Array<{ version: number }>
	return new Set(rows.map((r) => r.version))
}

/**
 * Run all pending migrations.
 *
 * @param db - The database connection
 * @returns Number of migrations run
 */
export function runMigrations(db: BetterSqlite3.Database): number {
	ensureMigrationsTable(db)

	const appliedVersions = getAppliedVersions(db)
	let runCount = 0

	for (const migration of migrations) {
		if (appliedVersions.has(migration.version)) {
			continue
		}

		// Run migration in a transaction
		db.transaction(() => {
			db.exec(migration.sql)
			db.prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
				migration.version,
				migration.name,
				new Date().toISOString(),
			)
		})()

		runCount++
	}

	return runCount
}

/**
 * Get the status of all migrations.
 *
 * @param db - The database connection
 * @returns Migration status with applied and pending lists
 */
export function getMigrationStatus(db: BetterSqlite3.Database): MigrationStatus {
	// Ensure table exists before querying
	ensureMigrationsTable(db)

	const appliedVersions = getAppliedVersions(db)

	const applied = db
		.prepare('SELECT version, name, applied_at FROM migrations ORDER BY version')
		.all() as Array<{ version: number; name: string; applied_at: string }>

	const pending = migrations
		.filter((m) => !appliedVersions.has(m.version))
		.map((m) => ({ version: m.version, name: m.name }))

	return {
		applied,
		pending,
		total: migrations.length,
	}
}
