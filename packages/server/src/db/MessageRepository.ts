import type BetterSqlite3 from 'better-sqlite3'

/**
 * Message structure for storage.
 */
export interface Message {
	id: number
	sessionId: string
	role: 'user' | 'assistant'
	content: string
	timestamp: number
}

/**
 * SQL statements for message operations.
 */
const SQL = {
	INSERT: `
		INSERT INTO messages (session_id, role, content, timestamp)
		VALUES (@sessionId, @role, @content, @timestamp)
	`,
	FIND_BY_SESSION_ID: `
		SELECT id, session_id, role, content, timestamp
		FROM messages
		WHERE session_id = ?
		ORDER BY timestamp ASC
	`,
} as const

/**
 * Database row representation for messages.
 */
interface MessageRow {
	id: number
	session_id: string
	role: string
	content: string
	timestamp: number
}

/**
 * Convert database row to Message object.
 */
function rowToMessage(row: MessageRow): Message {
	return {
		id: row.id,
		sessionId: row.session_id,
		role: row.role as Message['role'],
		content: row.content,
		timestamp: row.timestamp,
	}
}

/**
 * Repository for message database operations.
 */
export class MessageRepository {
	private db: BetterSqlite3.Database

	constructor(db: BetterSqlite3.Database) {
		this.db = db
	}

	/**
	 * Create a new message.
	 *
	 * @param message - The message to create (without id)
	 * @returns The id of the created message
	 * @throws Error if session_id doesn't exist (foreign key constraint)
	 */
	create(message: Omit<Message, 'id'>): number {
		const stmt = this.db.prepare(SQL.INSERT)
		const result = stmt.run({
			sessionId: message.sessionId,
			role: message.role,
			content: message.content,
			timestamp: message.timestamp,
		})
		return result.lastInsertRowid as number
	}

	/**
	 * Find all messages for a session.
	 *
	 * @param sessionId - The session id
	 * @returns Array of messages sorted by timestamp ascending
	 */
	findBySessionId(sessionId: string): Message[] {
		const stmt = this.db.prepare(SQL.FIND_BY_SESSION_ID)
		const rows = stmt.all(sessionId) as MessageRow[]
		return rows.map(rowToMessage)
	}

	/**
	 * Create multiple messages in a single transaction.
	 *
	 * @param messages - Array of messages to create
	 * @returns Array of created message ids
	 */
	createBatch(messages: Array<Omit<Message, 'id'>>): number[] {
		if (messages.length === 0) {
			return []
		}

		const stmt = this.db.prepare(SQL.INSERT)
		const ids: number[] = []

		const insertAll = this.db.transaction((msgs: Array<Omit<Message, 'id'>>) => {
			for (const msg of msgs) {
				const result = stmt.run({
					sessionId: msg.sessionId,
					role: msg.role,
					content: msg.content,
					timestamp: msg.timestamp,
				})
				ids.push(result.lastInsertRowid as number)
			}
		})

		insertAll(messages)
		return ids
	}
}
