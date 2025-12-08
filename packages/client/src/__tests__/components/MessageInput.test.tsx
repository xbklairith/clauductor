import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageInput } from '../../components/Input/MessageInput.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

// Mock socket
vi.mock('../../lib/socket.js', () => ({
	socket: {
		emit: vi.fn(),
	},
}))

describe('MessageInput', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		useSessionStore.setState({
			sessions: [],
			activeSessionId: 'session-1',
			isLoading: false,
			isSending: false,
			outputBuffer: new Map(),
			error: null,
		})
		useConnectionStore.setState({
			isConnected: true,
			isReconnecting: false,
		})
	})

	it('should render textarea', () => {
		render(<MessageInput />)

		expect(screen.getByRole('textbox')).toBeInTheDocument()
	})

	it('should submit message on Cmd+Enter', async () => {
		const { socket } = await import('../../lib/socket.js')
		render(<MessageInput />)

		const textarea = screen.getByRole('textbox')
		fireEvent.change(textarea, { target: { value: 'Hello' } })
		fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

		expect(socket.emit).toHaveBeenCalledWith('session:message', {
			sessionId: 'session-1',
			content: 'Hello',
		})
	})

	it('should submit message on Ctrl+Enter', async () => {
		const { socket } = await import('../../lib/socket.js')
		render(<MessageInput />)

		const textarea = screen.getByRole('textbox')
		fireEvent.change(textarea, { target: { value: 'Hello' } })
		fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

		expect(socket.emit).toHaveBeenCalledWith('session:message', {
			sessionId: 'session-1',
			content: 'Hello',
		})
	})

	it('should not submit on plain Enter (allows newlines)', async () => {
		const { socket } = await import('../../lib/socket.js')
		render(<MessageInput />)

		const textarea = screen.getByRole('textbox')
		fireEvent.change(textarea, { target: { value: 'Hello' } })
		fireEvent.keyDown(textarea, { key: 'Enter' })

		expect(socket.emit).not.toHaveBeenCalled()
	})

	it('should be disabled when no session selected', () => {
		useSessionStore.setState({ activeSessionId: null })

		render(<MessageInput />)

		expect(screen.getByRole('textbox')).toBeDisabled()
	})

	it('should be disabled when disconnected', () => {
		useConnectionStore.setState({ isConnected: false })

		render(<MessageInput />)

		expect(screen.getByRole('textbox')).toBeDisabled()
	})

	it('should clear after submit', async () => {
		render(<MessageInput />)

		const textarea = screen.getByRole('textbox')
		fireEvent.change(textarea, { target: { value: 'Hello' } })
		fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

		expect(textarea).toHaveValue('')
	})

	it('should be disabled when sending', () => {
		useSessionStore.setState({ isSending: true })

		render(<MessageInput />)

		expect(screen.getByRole('textbox')).toBeDisabled()
	})

	it('should show error message when error exists', () => {
		useSessionStore.setState({ error: 'Test error message' })

		render(<MessageInput />)

		expect(screen.getByText('Test error message')).toBeInTheDocument()
	})
})
