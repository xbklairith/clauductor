#!/usr/bin/env node

import { program } from 'commander'
import open from 'open'
import { createServer } from './server.js'
import { initializeContinueMode } from './utils/continueMode.js'
import { log } from './utils/logger.js'
import { checkPort, isValidPort, suggestNextPort } from './utils/port.js'
import { validateEnvironment } from './utils/validate.js'

const DEFAULT_PORT = 3001
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000']
const DEFAULT_DATA_DIR =
	process.env.CLAUDUCTOR_DATA_DIR ||
	(process.platform === 'darwin'
		? `${process.env.HOME}/Library/Application Support/clauductor`
		: `${process.env.HOME}/.local/share/clauductor`)

interface CliOptions {
	port: string
	noBrowser: boolean
	cors: string[]
	continue: boolean
	dataDir: string
}

program
	.name('clauductor')
	.description('Web interface for Claude Code CLI sessions')
	.option('-p, --port <number>', `Server port (default: ${DEFAULT_PORT})`, String(DEFAULT_PORT))
	.option('--no-browser', 'Do not open browser automatically')
	.option('--cors <origins...>', 'Allowed CORS origins', DEFAULT_CORS_ORIGINS)
	.option('-c, --continue', 'Continue the most recent session')
	.option('--data-dir <path>', 'Data directory for persistence', DEFAULT_DATA_DIR)
	.action(async (options: CliOptions) => {
		await main(options)
	})

async function main(options: CliOptions): Promise<void> {
	log.title('Clauductor')

	// Parse port
	const port = Number.parseInt(options.port, 10)
	if (!isValidPort(port)) {
		log.error(`Invalid port: ${options.port}`)
		process.exit(1)
	}

	// Handle --continue flag
	let continueSessionId: string | null = null
	if (options.continue) {
		log.info('Looking for recent session...')
		const continueResult = initializeContinueMode(options.dataDir)

		if (continueResult.hasHistory && continueResult.sessionId) {
			continueSessionId = continueResult.sessionId
			log.success(`Found session: ${continueResult.sessionName || continueResult.sessionId}`)
		} else {
			log.info('No previous sessions found, starting fresh')
		}
	}

	// Validate environment
	log.info('Checking environment...')
	const validation = await validateEnvironment()

	if (!validation.claudeCli.ok) {
		log.error(validation.claudeCli.message || 'Claude CLI check failed')
		if (validation.claudeCli.hint) {
			log.hint(validation.claudeCli.hint)
		}
		process.exit(1)
	}
	log.success('Claude CLI found')

	// Check port availability
	log.info(`Checking port ${port}...`)
	const portAvailable = await checkPort(port)

	if (!portAvailable) {
		const nextPort = await suggestNextPort(port)
		log.error(`Port ${port} is already in use`)
		if (nextPort) {
			log.hint(`Try: clauductor --port ${nextPort}`)
		}
		process.exit(1)
	}
	log.success(`Port ${port} available`)

	// Create and start server
	const server = createServer({
		port,
		corsOrigins: options.cors,
	})

	log.info('Starting server...')

	try {
		await server.start()
		log.success(`Server running at http://localhost:${port}`)

		// Open browser (with session ID if continuing)
		let url = `http://localhost:${port}`
		if (continueSessionId) {
			url = `${url}?session=${encodeURIComponent(continueSessionId)}`
		}

		if (!options.noBrowser) {
			log.info('Opening browser...')
			try {
				await open(url)
			} catch {
				log.warning('Could not open browser automatically')
				log.hint(`Open ${url} in your browser`)
			}
		} else {
			log.hint(`Open ${url} in your browser`)
		}

		log.raw('')
		log.info('Press Ctrl+C to stop')

		// Graceful shutdown
		const shutdown = async () => {
			log.raw('')
			log.info('Shutting down...')
			try {
				await server.stop()
				log.success('Server stopped')
				process.exit(0)
			} catch {
				log.error('Error during shutdown')
				process.exit(1)
			}
		}

		process.on('SIGINT', shutdown)
		process.on('SIGTERM', shutdown)

		// Windows support
		if (process.platform === 'win32') {
			process.on('SIGBREAK', shutdown)
		}
	} catch (err) {
		log.error(`Failed to start server: ${err instanceof Error ? err.message : 'Unknown error'}`)
		process.exit(1)
	}
}

program.parse()
