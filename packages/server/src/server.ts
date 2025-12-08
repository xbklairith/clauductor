import express from 'express'
import { createServer as createHttpServer } from 'node:http'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server as SocketIOServer } from 'socket.io'
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	SessionOutput,
	SessionStatus,
} from '@clauductor/shared'
import { SessionManager } from './services/SessionManager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ServerConfig {
	port: number
	corsOrigins: string[]
	dataDir?: string
	claudeCommand?: string
	staticDir?: string
}

export interface ClauductorServer {
	start(): Promise<void>
	stop(): Promise<void>
	readonly port: number
	readonly io: SocketIOServer
}

export function createServer(config: ServerConfig): ClauductorServer {
	const app = express()
	const httpServer = createHttpServer(app)

	const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
		cors: {
			origin: config.corsOrigins,
			methods: ['GET', 'POST'],
		},
	})

	const sessionManager = new SessionManager({
		dataDir: config.dataDir,
		claudeCommand: config.claudeCommand,
	})

	// Forward session events to Socket.io clients
	sessionManager.on('output', (_sessionId: string, output: SessionOutput) => {
		io.emit('session:output', output)
	})

	sessionManager.on('status', (_sessionId: string, status: SessionStatus) => {
		io.emit('session:status', status)
	})

	// Socket.io event handlers
	io.on('connection', (socket) => {
		// Send current session list on connect
		const sessions = sessionManager.getAllSessions()
		socket.emit('session:list', sessions)

		// Handle session creation
		socket.on('session:create', async (options) => {
			try {
				const session = await sessionManager.createSession(options)
				io.emit('session:created', session)
			} catch {
				// Handle error
			}
		})

		// Handle session message
		socket.on('session:message', (data) => {
			sessionManager.sendMessage(data.sessionId, data.content)
		})

		// Handle session destruction
		socket.on('session:destroy', async (data) => {
			await sessionManager.destroySession(data.sessionId)
			io.emit('session:destroyed', { sessionId: data.sessionId })
		})

		// Handle session list request
		socket.on('session:list', () => {
			const sessions = sessionManager.getAllSessions()
			socket.emit('session:list', sessions)
		})
	})

	// Health check endpoint
	app.get('/health', (_req, res) => {
		res.json({ status: 'ok' })
	})

	// Serve static files from client dist
	const staticDir = config.staticDir || join(__dirname, '../../client/dist')
	if (existsSync(staticDir)) {
		app.use(express.static(staticDir))
		// SPA fallback - serve index.html for all non-API routes
		app.get('*', (_req, res) => {
			res.sendFile(join(staticDir, 'index.html'))
		})
	}

	let isStarted = false

	return {
		get port() {
			return config.port
		},

		get io() {
			return io
		},

		async start(): Promise<void> {
			if (isStarted) return

			// Load existing sessions
			await sessionManager.loadSessions()

			return new Promise((resolve) => {
				httpServer.listen(config.port, () => {
					isStarted = true
					resolve()
				})
			})
		},

		async stop(): Promise<void> {
			if (!isStarted) return

			// Destroy all sessions
			await sessionManager.destroyAll()

			return new Promise((resolve, reject) => {
				io.close()
				httpServer.close((err) => {
					if (err) {
						reject(err)
					} else {
						isStarted = false
						resolve()
					}
				})
			})
		},
	}
}
