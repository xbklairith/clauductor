import type BetterSqlite3 from 'better-sqlite3'
import { type Database, createDatabase } from './Database.js'
import { getDataDir } from './paths.js'

/**
 * Connection health status information.
 */
export interface ConnectionHealth {
	isConnected: boolean
	walSize: number
	integrityOk: boolean
}

/**
 * Singleton manager for SQLite database connection lifecycle.
 *
 * SQLite with better-sqlite3 is synchronous and single-threaded.
 * Instead of connection pooling, we use a singleton pattern for
 * connection lifecycle management.
 */
export class DatabaseManager {
	private static instance: DatabaseManager | null = null
	private database: Database | null = null
	private isClosing = false
	private dataDir: string
	private shutdownHandlersRegistered = false

	private constructor(dataDir: string) {
		this.dataDir = dataDir
	}

	/**
	 * Get the singleton DatabaseManager instance.
	 *
	 * @param dataDir - Data directory for database file (only used on first call)
	 * @returns The singleton DatabaseManager instance
	 */
	static getInstance(dataDir?: string): DatabaseManager {
		if (!DatabaseManager.instance) {
			DatabaseManager.instance = new DatabaseManager(dataDir ?? getDataDir())
		}
		return DatabaseManager.instance
	}

	/**
	 * Reset the singleton instance (for testing only).
	 */
	static resetInstance(): void {
		if (DatabaseManager.instance) {
			try {
				if (DatabaseManager.instance.database) {
					DatabaseManager.instance.database.close()
				}
			} catch {
				// Ignore errors during reset
			}
			DatabaseManager.instance = null
		}
	}

	/**
	 * Get the database connection, creating it lazily if needed.
	 *
	 * @returns The better-sqlite3 database instance
	 * @throws Error if database is shutting down
	 */
	getConnection(): BetterSqlite3.Database {
		if (this.isClosing) {
			throw new Error('Database is shutting down')
		}

		if (!this.database) {
			this.database = createDatabase(this.dataDir)
		}

		return this.database.db
	}

	/**
	 * Check if the database connection is active.
	 */
	isConnected(): boolean {
		return this.database !== null && !this.isClosing
	}

	/**
	 * Close the database connection gracefully.
	 * Performs WAL checkpoint before closing.
	 */
	async close(): Promise<void> {
		this.isClosing = true

		if (this.database) {
			this.database.close()
			this.database = null
		}

		// Note: isClosing stays true to prevent reconnection after close
	}

	/**
	 * Check database connection health.
	 *
	 * @returns Health status including connectivity, WAL size, and integrity
	 */
	checkHealth(): ConnectionHealth {
		if (!this.database || this.isClosing) {
			return {
				isConnected: false,
				walSize: 0,
				integrityOk: false,
			}
		}

		try {
			const db = this.database.db

			// Quick connectivity test
			db.prepare('SELECT 1').get()

			// Check WAL size
			const walInfo = db.pragma('wal_checkpoint') as Array<{
				busy: number
				log: number
				checkpointed: number
			}>

			// Quick integrity check (not full check for performance)
			const integrity = db.pragma('quick_check') as Array<{ quick_check: string }>

			return {
				isConnected: true,
				walSize: walInfo[0]?.log ?? 0,
				integrityOk: integrity[0]?.quick_check === 'ok',
			}
		} catch {
			return {
				isConnected: false,
				walSize: 0,
				integrityOk: false,
			}
		}
	}

	/**
	 * Register shutdown handlers for graceful database closure.
	 * Should be called once during application startup.
	 */
	registerShutdownHandlers(): void {
		if (this.shutdownHandlersRegistered) {
			return
		}

		const shutdown = async () => {
			await this.close()
		}

		process.on('SIGTERM', shutdown)
		process.on('SIGINT', shutdown)

		this.shutdownHandlersRegistered = true
	}
}
