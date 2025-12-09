import type BetterSqlite3 from 'better-sqlite3'

/**
 * Output structure for storage.
 */
export interface Output {
	id: number
	sessionId: string
	type: string
	content: string
	event: string | null
	timestamp: number
}

/**
 * SQL statements for output operations.
 */
const SQL = {
	INSERT: `
		INSERT INTO outputs (session_id, type, content, event, timestamp)
		VALUES (@sessionId, @type, @content, @event, @timestamp)
	`,
	FIND_BY_SESSION_ID: `
		SELECT id, session_id, type, content, event, timestamp
		FROM outputs
		WHERE session_id = ?
		ORDER BY timestamp ASC
	`,
	FIND_BY_TYPE: `
		SELECT id, session_id, type, content, event, timestamp
		FROM outputs
		WHERE session_id = ? AND type = ?
		ORDER BY timestamp ASC
	`,
	DELETE_BY_SESSION_ID: `
		DELETE FROM outputs
		WHERE session_id = ?
	`,
} as const

/**
 * Database row representation for outputs.
 */
interface OutputRow {
	id: number
	session_id: string
	type: string
	content: string
	event: string | null
	timestamp: number
}

/**
 * Convert database row to Output object.
 */
function rowToOutput(row: OutputRow): Output {
	return {
		id: row.id,
		sessionId: row.session_id,
		type: row.type,
		content: row.content,
		event: row.event,
		timestamp: row.timestamp,
	}
}

/**
 * Repository for output database operations.
 */
export class OutputRepository {
	private db: BetterSqlite3.Database

	constructor(db: BetterSqlite3.Database) {
		this.db = db
	}

	/**
	 * Create a new output.
	 *
	 * @param output - The output to create (without id)
	 * @returns The id of the created output
	 * @throws Error if session_id doesn't exist (foreign key constraint)
	 */
	create(output: Omit<Output, 'id'>): number {
		const stmt = this.db.prepare(SQL.INSERT)
		const result = stmt.run({
			sessionId: output.sessionId,
			type: output.type,
			content: output.content,
			event: output.event,
			timestamp: output.timestamp,
		})
		return result.lastInsertRowid as number
	}

	/**
	 * Find all outputs for a session.
	 *
	 * @param sessionId - The session id
	 * @returns Array of outputs sorted by timestamp ascending
	 */
	findBySessionId(sessionId: string): Output[] {
		const stmt = this.db.prepare(SQL.FIND_BY_SESSION_ID)
		const rows = stmt.all(sessionId) as OutputRow[]
		return rows.map(rowToOutput)
	}

	/**
	 * Find outputs for a session filtered by type.
	 *
	 * @param sessionId - The session id
	 * @param type - The output type to filter by
	 * @returns Array of outputs sorted by timestamp ascending
	 */
	findByType(sessionId: string, type: string): Output[] {
		const stmt = this.db.prepare(SQL.FIND_BY_TYPE)
		const rows = stmt.all(sessionId, type) as OutputRow[]
		return rows.map(rowToOutput)
	}

	/**
	 * Create multiple outputs in a single transaction.
	 *
	 * @param outputs - Array of outputs to create
	 * @returns Array of created output ids
	 */
	createBatch(outputs: Array<Omit<Output, 'id'>>): number[] {
		if (outputs.length === 0) {
			return []
		}

		const stmt = this.db.prepare(SQL.INSERT)
		const ids: number[] = []

		const insertAll = this.db.transaction((items: Array<Omit<Output, 'id'>>) => {
			for (const output of items) {
				const result = stmt.run({
					sessionId: output.sessionId,
					type: output.type,
					content: output.content,
					event: output.event,
					timestamp: output.timestamp,
				})
				ids.push(result.lastInsertRowid as number)
			}
		})

		insertAll(outputs)
		return ids
	}

	/**
	 * Delete all outputs for a session.
	 *
	 * @param sessionId - The session id
	 * @returns Number of outputs deleted
	 */
	deleteBySessionId(sessionId: string): number {
		const stmt = this.db.prepare(SQL.DELETE_BY_SESSION_ID)
		const result = stmt.run(sessionId)
		return result.changes
	}
}
