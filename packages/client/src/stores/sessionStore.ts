import { create } from 'zustand'
import type {
	CreateSessionOptions,
	Session,
	SessionOutput,
} from '@clauductor/shared'
import { socket } from '../lib/socket.js'

const OUTPUT_BUFFER_LIMIT = 1000

export interface SessionState {
	// State
	sessions: Session[]
	activeSessionId: string | null
	isLoading: boolean
	outputBuffer: Map<string, SessionOutput[]>

	// Actions
	setSessions: (sessions: Session[]) => void
	addSession: (session: Session) => void
	removeSession: (sessionId: string) => void
	setActiveSession: (sessionId: string | null) => void
	updateSessionStatus: (sessionId: string, status: Session['status']) => void
	setLoading: (loading: boolean) => void

	// Async actions (emit to socket)
	createSession: (options?: CreateSessionOptions) => void
	sendMessage: (sessionId: string, content: string) => void
	destroySession: (sessionId: string) => void

	// Output handling
	appendOutput: (sessionId: string, output: SessionOutput) => void
	getOutput: (sessionId: string) => SessionOutput[]
	clearOutput: (sessionId: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
	sessions: [],
	activeSessionId: null,
	isLoading: false,
	outputBuffer: new Map(),

	setSessions: (sessions) => set({ sessions }),

	addSession: (session) =>
		set((state) => ({
			sessions: [...state.sessions, session],
		})),

	removeSession: (sessionId) =>
		set((state) => {
			const buffer = new Map(state.outputBuffer)
			buffer.delete(sessionId)
			return {
				sessions: state.sessions.filter((s) => s.id !== sessionId),
				activeSessionId:
					state.activeSessionId === sessionId ? null : state.activeSessionId,
				outputBuffer: buffer,
			}
		}),

	setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

	updateSessionStatus: (sessionId, status) =>
		set((state) => ({
			sessions: state.sessions.map((s) =>
				s.id === sessionId ? { ...s, status } : s,
			),
		})),

	setLoading: (loading) => set({ isLoading: loading }),

	createSession: (options) => {
		set({ isLoading: true })
		socket.emit('session:create', options ?? {})
	},

	sendMessage: (sessionId, content) => {
		socket.emit('session:message', { sessionId, content })
	},

	destroySession: (sessionId) => {
		socket.emit('session:destroy', { sessionId })
	},

	appendOutput: (sessionId, output) =>
		set((state) => {
			const buffer = new Map(state.outputBuffer)
			const existing = buffer.get(sessionId) ?? []
			// Keep last OUTPUT_BUFFER_LIMIT entries
			buffer.set(sessionId, [...existing.slice(-(OUTPUT_BUFFER_LIMIT - 1)), output])
			return { outputBuffer: buffer }
		}),

	getOutput: (sessionId) => get().outputBuffer.get(sessionId) ?? [],

	clearOutput: (sessionId) =>
		set((state) => {
			const buffer = new Map(state.outputBuffer)
			buffer.set(sessionId, [])
			return { outputBuffer: buffer }
		}),
}))
