import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MainLayout } from '../../components/Layout/MainLayout.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

// Mock socket
vi.mock('../../lib/socket.js', () => ({
	socket: {
		emit: vi.fn(),
	},
}))

// Mock xterm (avoid DOM manipulation in tests)
vi.mock('@xterm/xterm', () => ({
	Terminal: vi.fn().mockImplementation(() => ({
		loadAddon: vi.fn(),
		open: vi.fn(),
		write: vi.fn(),
		clear: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock('@xterm/addon-fit', () => ({
	FitAddon: vi.fn().mockImplementation(() => ({
		fit: vi.fn(),
	})),
}))

describe('MainLayout', () => {
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

	it('should render sidebar and main content', () => {
		render(<MainLayout />)

		// Sidebar contains the new session button
		expect(screen.getByText('+ New Session')).toBeInTheDocument()
	})

	it('should have fixed width sidebar (w-64)', () => {
		render(<MainLayout />)

		// Check for the sidebar element
		const sidebar = screen.getByText('+ New Session').closest('aside')
		expect(sidebar).toHaveClass('w-64')
	})

	it('should have flex-1 main content', () => {
		render(<MainLayout />)

		// Main should have flex-1
		const main = screen.getByRole('main')
		expect(main).toHaveClass('flex-1')
	})
})
