import type { Session } from '@clauductor/shared'
import { createDatabase } from '../db/Database.js'
import { SessionRepository } from '../db/SessionRepository.js'
import { runMigrations } from '../db/migrations/runner.js'

/**
 * Result of initializing continue mode.
 */
export interface ContinueModeResult {
	sessionId: string | null
	sessionName: string | null
	hasHistory: boolean
}

/**
 * Find the most recently updated session.
 *
 * @param sessionRepo - The session repository
 * @returns The most recent session or null if none exist
 */
export function findMostRecentSession(sessionRepo: SessionRepository): Session | null {
	return sessionRepo.findMostRecent()
}

/**
 * Initialize continue mode by finding the most recent session.
 *
 * @param dataDir - The data directory containing the database
 * @returns Information about the session to continue, or null values if none
 */
export function initializeContinueMode(dataDir: string): ContinueModeResult {
	try {
		const database = createDatabase(dataDir)
		runMigrations(database.db)
		const sessionRepo = new SessionRepository(database.db)

		const session = findMostRecentSession(sessionRepo)

		database.close()

		if (session) {
			return {
				sessionId: session.id,
				sessionName: session.name,
				hasHistory: true,
			}
		}

		return {
			sessionId: null,
			sessionName: null,
			hasHistory: false,
		}
	} catch {
		return {
			sessionId: null,
			sessionName: null,
			hasHistory: false,
		}
	}
}
