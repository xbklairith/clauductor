import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import type { Session, SessionOutput } from '@clauductor/shared'

export interface FileStorageConfig {
	dataDir?: string
}

export class FileStorage {
	private dataDir: string

	constructor(config: FileStorageConfig = {}) {
		this.dataDir = config.dataDir || this.getDefaultDataDir()
	}

	private getDefaultDataDir(): string {
		return process.env.CLAUDUCTOR_DATA_DIR || path.join(os.homedir(), '.clauductor')
	}

	getDataDir(): string {
		return this.dataDir
	}

	getSessionsDir(): string {
		return path.join(this.dataDir, 'sessions')
	}

	async ensureDataDir(): Promise<void> {
		await fs.mkdir(this.getSessionsDir(), { recursive: true })
	}

	async saveSession(session: Session): Promise<void> {
		await this.ensureDataDir()
		const filePath = path.join(this.getSessionsDir(), `${session.id}.json`)
		await fs.writeFile(filePath, JSON.stringify(session, null, '\t'), 'utf-8')
	}

	async loadSession(id: string): Promise<Session | null> {
		try {
			const filePath = path.join(this.getSessionsDir(), `${id}.json`)
			const content = await fs.readFile(filePath, 'utf-8')
			return JSON.parse(content) as Session
		} catch {
			return null
		}
	}

	async loadAllSessions(): Promise<Session[]> {
		try {
			await this.ensureDataDir()
			const files = await fs.readdir(this.getSessionsDir())
			const sessions: Session[] = []

			for (const file of files) {
				if (file.endsWith('.json')) {
					const id = file.replace('.json', '')
					const session = await this.loadSession(id)
					if (session) {
						sessions.push(session)
					}
				}
			}

			return sessions
		} catch {
			return []
		}
	}

	async deleteSession(id: string): Promise<void> {
		try {
			const filePath = path.join(this.getSessionsDir(), `${id}.json`)
			await fs.unlink(filePath)
		} catch {
			// Ignore if file doesn't exist
		}
	}

	async appendOutput(_sessionId: string, _output: SessionOutput): Promise<void> {
		// Optional: append output to history file
		// For MVP, we don't persist output history
	}

	async loadOutputHistory(_sessionId: string, _limit = 1000): Promise<SessionOutput[]> {
		// Optional: load output history from file
		// For MVP, we don't persist output history
		return []
	}
}
