import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import type {
	CreateSessionOptions,
	Session,
	SessionOutput,
	SessionStatus,
} from '@clauductor/shared'
import { FileStorage } from './FileStorage.js'
import { OutputParser } from './OutputParser.js'
import { ProcessPool, type ProcessHandle } from './ProcessPool.js'

export interface SessionManagerConfig {
	dataDir?: string
	claudeCommand?: string
}

interface ManagedSession {
	session: Session
	processHandle?: ProcessHandle
	parser: OutputParser
}

export class SessionManager extends EventEmitter {
	private sessions = new Map<string, ManagedSession>()
	private fileStorage: FileStorage
	private processPool: ProcessPool
	private claudeCommand: string

	constructor(config: SessionManagerConfig = {}) {
		super()
		this.fileStorage = new FileStorage({ dataDir: config.dataDir })
		this.processPool = new ProcessPool()
		this.claudeCommand = config.claudeCommand || 'claude'
	}

	async createSession(options: CreateSessionOptions = {}): Promise<Session> {
		const id = nanoid(10)
		const now = new Date().toISOString()

		const session: Session = {
			id,
			name: options.name || `Session ${id.slice(0, 4)}`,
			status: 'idle',
			workingDir: options.workingDir || process.cwd(),
			createdAt: now,
			updatedAt: now,
		}

		const parser = new OutputParser()
		const managed: ManagedSession = { session, parser }
		this.sessions.set(id, managed)

		// Persist session
		await this.fileStorage.saveSession(session)

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

		// Delete from file storage
		await this.fileStorage.deleteSession(sessionId)

		// Remove from memory
		this.sessions.delete(sessionId)
	}

	async destroyAll(): Promise<void> {
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
				args: [], // Can add --output-format stream-json later
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

		// Persist (non-blocking)
		this.fileStorage.saveSession(managed.session).catch(() => {
			// Log error but don't fail
		})
	}

	async loadSessions(): Promise<void> {
		const sessions = await this.fileStorage.loadAllSessions()

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

		await this.fileStorage.saveSession(managed.session)
	}
}
