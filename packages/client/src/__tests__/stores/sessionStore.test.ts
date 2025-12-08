import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useSessionStore } from '../../stores/sessionStore.js'
import type { Session, SessionOutput } from '@clauductor/shared'

// Mock socket
vi.mock('../../lib/socket.js', () => ({
	socket: {
		emit: vi.fn(),
	},
}))

describe('sessionStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		useSessionStore.setState({
			sessions: [],
			activeSessionId: null,
			isLoading: false,
			outputBuffer: new Map(),
		})
	})

	describe('setSessions', () => {
		it('should replace sessions array', () => {
			const sessions: Session[] = [
				{
					id: '1',
					name: 'Session 1',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01',
				},
			]

			const { setSessions } = useSessionStore.getState()
			setSessions(sessions)

			const state = useSessionStore.getState()
			expect(state.sessions).toEqual(sessions)
		})
	})

	describe('addSession', () => {
		it('should append session to array', () => {
			const session: Session = {
				id: '1',
				name: 'Session 1',
				status: 'idle',
				workingDir: '/tmp',
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01',
			}

			const { addSession } = useSessionStore.getState()
			addSession(session)

			const state = useSessionStore.getState()
			expect(state.sessions).toHaveLength(1)
			expect(state.sessions[0]).toEqual(session)
		})
	})

	describe('removeSession', () => {
		it('should filter out session', () => {
			const sessions: Session[] = [
				{
					id: '1',
					name: 'Session 1',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01',
				},
				{
					id: '2',
					name: 'Session 2',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01',
				},
			]

			useSessionStore.setState({ sessions })

			const { removeSession } = useSessionStore.getState()
			removeSession('1')

			const state = useSessionStore.getState()
			expect(state.sessions).toHaveLength(1)
			expect(state.sessions[0].id).toBe('2')
		})

		it('should clear activeSessionId if removing active session', () => {
			const sessions: Session[] = [
				{
					id: '1',
					name: 'Session 1',
					status: 'idle',
					workingDir: '/tmp',
					createdAt: '2025-01-01',
					updatedAt: '2025-01-01',
				},
			]

			useSessionStore.setState({ sessions, activeSessionId: '1' })

			const { removeSession } = useSessionStore.getState()
			removeSession('1')

			const state = useSessionStore.getState()
			expect(state.activeSessionId).toBeNull()
		})
	})

	describe('setActiveSession', () => {
		it('should update active session ID', () => {
			const { setActiveSession } = useSessionStore.getState()
			setActiveSession('123')

			const state = useSessionStore.getState()
			expect(state.activeSessionId).toBe('123')
		})
	})

	describe('appendOutput', () => {
		it('should buffer output for session', () => {
			const output: SessionOutput = {
				sessionId: '1',
				type: 'raw',
				content: 'Hello',
				timestamp: Date.now(),
			}

			const { appendOutput } = useSessionStore.getState()
			appendOutput('1', output)

			const state = useSessionStore.getState()
			expect(state.outputBuffer.get('1')).toHaveLength(1)
			expect(state.outputBuffer.get('1')?.[0]).toEqual(output)
		})

		it('should limit buffer to 1000 items', () => {
			const { appendOutput } = useSessionStore.getState()

			// Add 1001 items
			for (let i = 0; i < 1001; i++) {
				appendOutput('1', {
					sessionId: '1',
					type: 'raw',
					content: `Message ${i}`,
					timestamp: Date.now(),
				})
			}

			const state = useSessionStore.getState()
			expect(state.outputBuffer.get('1')).toHaveLength(1000)
		})
	})

	describe('getOutput', () => {
		it('should return output for session', () => {
			const output: SessionOutput = {
				sessionId: '1',
				type: 'raw',
				content: 'Hello',
				timestamp: Date.now(),
			}

			const buffer = new Map<string, SessionOutput[]>()
			buffer.set('1', [output])
			useSessionStore.setState({ outputBuffer: buffer })

			const { getOutput } = useSessionStore.getState()
			const result = getOutput('1')

			expect(result).toEqual([output])
		})

		it('should return empty array for unknown session', () => {
			const { getOutput } = useSessionStore.getState()
			const result = getOutput('unknown')

			expect(result).toEqual([])
		})
	})
})
