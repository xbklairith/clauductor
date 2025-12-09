import { EventEmitter } from 'node:events'
import { existsSync, statSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import type {
	CreateSessionOptions,
	Session,
	SessionOutput,
	SessionStatus,
} from '@clauductor/shared'
import { nanoid } from 'nanoid'
import type { SessionRepository } from '../db/SessionRepository.js'
import { FileStorage } from './FileStorage.js'
import { OutputParser } from './OutputParser.js'
import { type ProcessHandle, ProcessPool } from './ProcessPool.js'

export interface SessionManagerConfig {
	dataDir?: string
	claudeCommand?: string
	persistenceInterval?: number // ms between auto-saves
	sessionRepository?: SessionRepository // Optional database repository
}

interface ManagedSession {
	session: Session
	processHandle?: ProcessHandle
	parser: OutputParser
}

export class SessionManager extends EventEmitter {
	private sessions = new Map<string, ManagedSession>()
	private fileStorage: FileStorage
	private sessionRepo?: SessionRepository
	private processPool: ProcessPool
	private claudeCommand: string
	private persistenceTimer?: ReturnType<typeof setInterval>
	private persistenceInterval: number

	constructor(config: SessionManagerConfig = {}) {
		super()
		this.fileStorage = new FileStorage({ dataDir: config.dataDir })
		this.sessionRepo = config.sessionRepository
		this.processPool = new ProcessPool()
		this.claudeCommand = config.claudeCommand || 'claude'
		this.persistenceInterval = config.persistenceInterval ?? 30000 // 30s default
		this.startPeriodicPersistence()
	}

	/**
	 * Validate and normalize a working directory path.
	 * Throws if path is invalid, doesn't exist, or isn't a directory.
	 */
	private validateWorkingDir(workingDir: string): string {
		// Normalize and resolve to absolute path
		const normalized = normalize(resolve(workingDir))

		// Check for path traversal attempts (e.g., containing ..)
		if (workingDir.includes('..')) {
			throw new Error('Invalid working directory: path traversal not allowed')
		}

		// Check if path exists
		if (!existsSync(normalized)) {
			throw new Error(`Working directory does not exist: ${normalized}`)
		}

		// Check if it's a directory
		const stats = statSync(normalized)
		if (!stats.isDirectory()) {
			throw new Error(`Path is not a directory: ${normalized}`)
		}

		return normalized
	}

	/**
	 * Start periodic persistence for active sessions (REQ-011)
	 */
	private startPeriodicPersistence(): void {
		this.persistenceTimer = setInterval(() => {
			this.persistAllSessions()
		}, this.persistenceInterval)
	}

	/**
	 * Save all sessions to storage (non-blocking)
	 */
	private persistAllSessions(): void {
		for (const managed of this.sessions.values()) {
			if (this.sessionRepo) {
				try {
					this.sessionRepo.update(managed.session)
				} catch {
					// Log error but don't fail - persistence is best-effort
				}
			} else {
				this.fileStorage.saveSession(managed.session).catch(() => {
					// Log error but don't fail - persistence is best-effort
				})
			}
		}
	}

	async createSession(options: CreateSessionOptions = {}): Promise<Session> {
		const id = nanoid(10)
		const now = new Date().toISOString()

		// Validate working directory (REQ-028)
		const workingDir = this.validateWorkingDir(options.workingDir || process.cwd())

		const session: Session = {
			id,
			name: options.name || `Session ${id.slice(0, 4)}`,
			status: 'idle',
			workingDir,
			createdAt: now,
			updatedAt: now,
		}

		const parser = new OutputParser()
		const managed: ManagedSession = { session, parser }
		this.sessions.set(id, managed)

		// Persist session - prefer database, fallback to file
		if (this.sessionRepo) {
			this.sessionRepo.create(session)
		} else {
			await this.fileStorage.saveSession(session)
		}

		// Spawn Claude CLI process immediately (REQ-002)
		this.spawnProcess(id)

		return session
	}

	getSession(id: string): Session | undefined {
		return this.sessions.get(id)?.session
	}

	getAllSessions(): Session[] {
		return Array.from(this.sessions.values()).map((m) => m.session)
	}

	async destroySession(sessionId: string): Promise<void> {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		// Kill process if running
		if (managed.processHandle) {
			this.processPool.kill(managed.processHandle.id)
		}

		// Delete from storage - prefer database (soft delete), fallback to file
		if (this.sessionRepo) {
			this.sessionRepo.delete(sessionId)
		} else {
			await this.fileStorage.deleteSession(sessionId)
		}

		// Remove from memory
		this.sessions.delete(sessionId)
	}

	async destroyAll(): Promise<void> {
		// Stop periodic persistence
		if (this.persistenceTimer) {
			clearInterval(this.persistenceTimer)
			this.persistenceTimer = undefined
		}

		const sessionIds = Array.from(this.sessions.keys())
		for (const id of sessionIds) {
			await this.destroySession(id)
		}
	}

	sendMessage(sessionId: string, message: string): void {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		// If no process, spawn one
		if (!managed.processHandle) {
			this.spawnProcess(sessionId)
		}

		// Update status to running
		this.updateSessionStatus(sessionId, 'running')

		// Write message to process
		if (managed.processHandle) {
			this.processPool.write(managed.processHandle.id, `${message}\n`)
		}
	}

	private spawnProcess(sessionId: string): void {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		try {
			const handle = this.processPool.spawn({
				command: this.claudeCommand,
				args: ['--output-format', 'stream-json'], // REQ-012/016: Enable structured events
				cwd: managed.session.workingDir,
			})

			managed.processHandle = handle
			managed.parser.reset()

			handle.onData((data) => {
				this.handleOutput(sessionId, data)
			})

			handle.onExit((code, signal) => {
				this.handleProcessExit(sessionId, code, signal)
			})
		} catch {
			this.updateSessionStatus(sessionId, 'error')
			this.emit('status', sessionId, {
				sessionId,
				status: 'error',
			})
		}
	}

	private handleOutput(sessionId: string, data: string): void {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		const parsed = managed.parser.parse(data)

		for (const output of parsed) {
			const sessionOutput: SessionOutput = {
				sessionId,
				type: output.type,
				content: output.content,
				event: output.event,
				timestamp: Date.now(),
			}

			this.emit('output', sessionId, sessionOutput)
		}
	}

	private handleProcessExit(sessionId: string, code: number, _signal?: string): void {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		managed.processHandle = undefined

		const newStatus = code === 0 ? 'idle' : 'error'
		this.updateSessionStatus(sessionId, newStatus)
	}

	private async updateSessionStatus(sessionId: string, status: Session['status']): Promise<void> {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		managed.session.status = status
		managed.session.updatedAt = new Date().toISOString()

		// Emit status event
		this.emit('status', sessionId, {
			sessionId,
			status,
		} as SessionStatus)

		// Persist (non-blocking) - prefer database, fallback to file
		if (this.sessionRepo) {
			try {
				this.sessionRepo.update(managed.session)
			} catch {
				// Log error but don't fail
			}
		} else {
			this.fileStorage.saveSession(managed.session).catch(() => {
				// Log error but don't fail
			})
		}
	}

	async loadSessions(): Promise<void> {
		const sessions = this.sessionRepo
			? this.sessionRepo.findAll()
			: await this.fileStorage.loadAllSessions()

		for (const session of sessions) {
			// Reset status to idle on load (process is not running)
			session.status = 'idle'
			const parser = new OutputParser()
			this.sessions.set(session.id, { session, parser })
		}
	}

	async saveSession(sessionId: string): Promise<void> {
		const managed = this.sessions.get(sessionId)
		if (!managed) return

		if (this.sessionRepo) {
			this.sessionRepo.update(managed.session)
		} else {
			await this.fileStorage.saveSession(managed.session)
		}
	}
}
