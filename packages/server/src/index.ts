// Re-export types from shared for convenience
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

// Server exports will be added in backend-core feature
export const VERSION = '0.1.0'
