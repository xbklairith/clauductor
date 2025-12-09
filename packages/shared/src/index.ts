// Session types
export interface Session {
	id: string
	name: string
	status: 'idle' | 'running' | 'error'
	workingDir: string
	createdAt: string // ISO string for JSON serialization
	updatedAt: string
}

export interface CreateSessionOptions {
	name?: string
	workingDir?: string
}

export interface SessionMessage {
	sessionId: string
	content: string
}

// History types
export interface HistoryMessage {
	id: number
	sessionId: string
	role: 'user' | 'assistant'
	content: string
	timestamp: number
}

export interface HistoryOutput {
	id: number
	sessionId: string
	type: string
	content: string
	event: string | null
	timestamp: number
}

export interface SessionHistoryData {
	sessionId: string
	messages: HistoryMessage[]
	outputs: HistoryOutput[]
}

export interface SessionStatus {
	sessionId: string
	status: Session['status']
}

// Output types
export interface SessionOutput {
	sessionId: string
	type: 'raw' | 'parsed'
	content: string
	event?: ParsedEvent
	timestamp: number
}

export type ParsedEvent =
	| { type: 'text'; content: string }
	| { type: 'tool_use'; tool: string; input: unknown }
	| { type: 'tool_result'; output: string }
	| { type: 'thinking'; content: string }
	| { type: 'error'; message: string }

// Socket event types
export interface ServerToClientEvents {
	'session:created': (session: Session) => void
	'session:output': (data: SessionOutput) => void
	'session:status': (data: SessionStatus) => void
	'session:destroyed': (data: { sessionId: string }) => void
	'session:list': (sessions: Session[]) => void
	'session:error': (data: { sessionId?: string; message: string }) => void
	'session:history': (data: SessionHistoryData) => void
}

export interface ClientToServerEvents {
	'session:create': (options: CreateSessionOptions) => void
	'session:message': (data: SessionMessage) => void
	'session:destroy': (data: { sessionId: string }) => void
	'session:list': () => void
	'session:history': (data: { sessionId: string }) => void
}
