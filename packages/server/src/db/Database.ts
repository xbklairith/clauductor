import * as fs from 'node:fs'
import BetterSqlite3 from 'better-sqlite3'
import { getDatabasePath } from './paths.js'

/**
 * Database wrapper that manages SQLite connection with WAL mode.
 * This is the core database interface for session persistence.
 */
export interface Database {
	/** The underlying better-sqlite3 database instance */
	readonly db: BetterSqlite3.Database
	/** Close the database connection with WAL checkpoint */
	close(): void
}

/**
 * Error thrown when database operations fail.
 */
export class DatabaseError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message)
		this.name = 'DatabaseError'
	}
}

/**
 * Creates a new SQLite database connection with optimized settings.
 *
 * @param dataDir - Directory where the database file will be stored
 * @returns Database instance with WAL mode enabled
 * @throws DatabaseError if database cannot be created (permission issues, etc.)
 */
export function createDatabase(dataDir: string): Database {
	const dbPath = getDatabasePath(dataDir)

	try {
		// Ensure directory exists with proper permissions (0700)
		fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })

		const db = new BetterSqlite3(dbPath)

		// Enable WAL mode for better concurrency
		db.pragma('journal_mode = WAL')

		// Balance between safety and speed
		db.pragma('synchronous = NORMAL')

		// Enable foreign key constraints
		db.pragma('foreign_keys = ON')

		// Set busy timeout for lock contention (5 seconds)
		db.pragma('busy_timeout = 5000')

		return {
			db,
			close() {
				// Checkpoint WAL before closing to flush all data
				db.pragma('wal_checkpoint(TRUNCATE)')
				db.close()
			},
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('EACCES')) {
			throw new DatabaseError(
				`Permission denied: Cannot create database at ${dbPath}. Check directory permissions.`,
				error,
			)
		}
		if (error instanceof Error && error.message.includes('ENOENT')) {
			throw new DatabaseError(`Cannot create database: Directory does not exist: ${dataDir}`, error)
		}
		throw new DatabaseError(`Failed to create database at ${dbPath}`, error)
	}
}
