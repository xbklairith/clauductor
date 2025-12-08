import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewSessionButton } from '../../components/Session/NewSessionButton.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

// Mock socket
vi.mock('../../lib/socket.js', () => ({
	socket: {
		emit: vi.fn(),
	},
}))

describe('NewSessionButton', () => {
	beforeEach(() => {
		useSessionStore.setState({
			sessions: [],
			activeSessionId: null,
			isLoading: false,
			outputBuffer: new Map(),
		})
		useConnectionStore.setState({
			isConnected: true,
			isReconnecting: false,
		})
	})

	it('should render button', () => {
		render(<NewSessionButton />)

		expect(screen.getByRole('button')).toHaveTextContent('+ New Session')
	})

	it('should call createSession on click', async () => {
		const { socket } = await import('../../lib/socket.js')
		render(<NewSessionButton />)

		fireEvent.click(screen.getByRole('button'))

		expect(socket.emit).toHaveBeenCalledWith('session:create', {})
	})

	it('should be disabled when loading', () => {
		useSessionStore.setState({ isLoading: true })

		render(<NewSessionButton />)

		expect(screen.getByRole('button')).toBeDisabled()
		expect(screen.getByText('Creating...')).toBeInTheDocument()
	})

	it('should be disabled when not connected', () => {
		useConnectionStore.setState({ isConnected: false })

		render(<NewSessionButton />)

		expect(screen.getByRole('button')).toBeDisabled()
	})
})
