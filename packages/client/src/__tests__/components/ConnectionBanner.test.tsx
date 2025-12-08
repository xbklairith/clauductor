import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionBanner } from '../../components/Common/ConnectionBanner.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

describe('ConnectionBanner', () => {
	beforeEach(() => {
		useConnectionStore.setState({
			isConnected: false,
			isReconnecting: false,
		})
	})

	it('should be hidden when connected', () => {
		useConnectionStore.setState({ isConnected: true })

		render(<ConnectionBanner />)

		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})

	it('should show "Disconnected" when not connected', () => {
		useConnectionStore.setState({ isConnected: false, isReconnecting: false })

		render(<ConnectionBanner />)

		expect(screen.getByRole('alert')).toHaveTextContent('Disconnected')
	})

	it('should show "Reconnecting" when reconnecting', () => {
		useConnectionStore.setState({ isConnected: false, isReconnecting: true })

		render(<ConnectionBanner />)

		expect(screen.getByRole('alert')).toHaveTextContent('Reconnecting')
	})
})
