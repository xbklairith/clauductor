import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionList } from '../../components/Session/SessionList.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import type { Session } from '@clauductor/shared'

// Mock socket
vi.mock('../../lib/socket.js', () => ({
	socket: {
		emit: vi.fn(),
	},
}))

describe('SessionList', () => {
	beforeEach(() => {
		useSessionStore.setState({
			sessions: [],
			activeSessionId: null,
			isLoading: false,
			outputBuffer: new Map(),
		})
	})

	it('should render list of sessions', () => {
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
				status: 'running',
				workingDir: '/tmp',
				createdAt: '2025-01-01',
				updatedAt: '2025-01-01',
			},
		]

		useSessionStore.setState({ sessions })

		render(<SessionList />)

		expect(screen.getByText('Session 1')).toBeInTheDocument()
		expect(screen.getByText('Session 2')).toBeInTheDocument()
	})

	it('should show empty state when no sessions', () => {
		useSessionStore.setState({ sessions: [] })

		render(<SessionList />)

		expect(screen.getByText('No sessions yet')).toBeInTheDocument()
	})

	it('should call setActiveSession when clicking a session', () => {
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

		useSessionStore.setState({ sessions })

		render(<SessionList />)

		fireEvent.click(screen.getByText('Session 1'))

		const state = useSessionStore.getState()
		expect(state.activeSessionId).toBe('1')
	})
})
