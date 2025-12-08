// Re-export types from shared
export type {
	Session,
	CreateSessionOptions,
	SessionMessage,
	SessionStatus,
	SessionOutput,
	ParsedEvent,
	ServerToClientEvents,
	ClientToServerEvents,
} from '@clauductor/shared'

// Export server
export { createServer, type ServerConfig, type ClauductorServer } from './server.js'

// Export services
export { FileStorage, type FileStorageConfig } from './services/FileStorage.js'
export { OutputParser, type ParsedOutput, type OutputMode } from './services/OutputParser.js'
export { ProcessPool, type SpawnOptions, type ProcessHandle } from './services/ProcessPool.js'
export { SessionManager, type SessionManagerConfig } from './services/SessionManager.js'

// Package version
export const VERSION = '0.1.0'
