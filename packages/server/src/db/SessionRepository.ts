import type { Session } from '@clauductor/shared'
import type BetterSqlite3 from 'better-sqlite3'

/**
 * SQL statements for session operations.
 */
const SQL = {
	INSERT: `
		INSERT INTO sessions (id, name, status, working_dir, created_at, updated_at, deleted_at)
		VALUES (@id, @name, @status, @workingDir, @createdAt, @updatedAt, @deletedAt)
	`,
	UPDATE: `
		UPDATE sessions
		SET name = @name, status = @status, working_dir = @workingDir, updated_at = @updatedAt
		WHERE id = @id
	`,
	SOFT_DELETE: `
		UPDATE sessions
		SET deleted_at = @deletedAt
		WHERE id = @id
	`,
	FIND_BY_ID: `
		SELECT id, name, status, working_dir, created_at, updated_at, deleted_at
		FROM sessions
		WHERE id = ? AND deleted_at IS NULL
	`,
	FIND_ALL: `
		SELECT id, name, status, working_dir, created_at, updated_at, deleted_at
		FROM sessions
		WHERE deleted_at IS NULL
		ORDER BY updated_at DESC
	`,
	FIND_MOST_RECENT: `
		SELECT id, name, status, working_dir, created_at, updated_at, deleted_at
		FROM sessions
		WHERE deleted_at IS NULL
		ORDER BY updated_at DESC
		LIMIT 1
	`,
} as const

/**
 * Database row representation for sessions.
 */
interface SessionRow {
	id: string
	name: string
	status: string
	working_dir: string
	created_at: string
	updated_at: string
	deleted_at: string | null
}

/**
 * Convert database row to Session object.
 */
function rowToSession(row: SessionRow): Session {
	return {
		id: row.id,
		name: row.name,
		status: row.status as Session['status'],
		workingDir: row.working_dir,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

/**
 * Repository for session database operations.
 */
export class SessionRepository {
	private db: BetterSqlite3.Database

	constructor(db: BetterSqlite3.Database) {
		this.db = db
	}

	/**
	 * Create a new session.
	 *
	 * @param session - The session to create
	 * @throws Error if session with same id already exists
	 */
	create(session: Session): void {
		const stmt = this.db.prepare(SQL.INSERT)
		stmt.run({
			id: session.id,
			name: session.name,
			status: session.status,
			workingDir: session.workingDir,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			deletedAt: null,
		})
	}

	/**
	 * Update an existing session.
	 *
	 * @param session - The session with updated values
	 */
	update(session: Session): void {
		const stmt = this.db.prepare(SQL.UPDATE)
		stmt.run({
			id: session.id,
			name: session.name,
			status: session.status,
			workingDir: session.workingDir,
			updatedAt: session.updatedAt,
		})
	}

	/**
	 * Find a session by id.
	 *
	 * @param id - The session id
	 * @returns The session if found, null otherwise
	 */
	findById(id: string): Session | null {
		const stmt = this.db.prepare(SQL.FIND_BY_ID)
		const row = stmt.get(id) as SessionRow | undefined

		if (!row) {
			return null
		}

		return rowToSession(row)
	}

	/**
	 * Find all sessions (excluding soft-deleted).
	 *
	 * @returns Array of sessions sorted by updatedAt descending
	 */
	findAll(): Session[] {
		const stmt = this.db.prepare(SQL.FIND_ALL)
		const rows = stmt.all() as SessionRow[]

		return rows.map(rowToSession)
	}

	/**
	 * Soft delete a session by setting deleted_at timestamp.
	 *
	 * @param id - The session id to delete
	 */
	delete(id: string): void {
		const stmt = this.db.prepare(SQL.SOFT_DELETE)
		stmt.run({
			id,
			deletedAt: new Date().toISOString(),
		})
	}

	/**
	 * Find the most recently updated session.
	 *
	 * @returns The most recent session or null if none exist
	 */
	findMostRecent(): Session | null {
		const stmt = this.db.prepare(SQL.FIND_MOST_RECENT)
		const row = stmt.get() as SessionRow | undefined

		if (!row) {
			return null
		}

		return rowToSession(row)
	}
}
