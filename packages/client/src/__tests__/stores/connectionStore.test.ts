import { describe, expect, it, beforeEach } from 'vitest'
import { useConnectionStore } from '../../stores/connectionStore.js'

describe('connectionStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		useConnectionStore.setState({
			isConnected: false,
			isReconnecting: false,
		})
	})

	it('should have initial state as disconnected', () => {
		const state = useConnectionStore.getState()

		expect(state.isConnected).toBe(false)
		expect(state.isReconnecting).toBe(false)
	})

	it('should update state with setConnected', () => {
		const { setConnected } = useConnectionStore.getState()

		setConnected(true)

		const state = useConnectionStore.getState()
		expect(state.isConnected).toBe(true)
		expect(state.isReconnecting).toBe(false)
	})

	it('should reset isReconnecting when setConnected is called', () => {
		useConnectionStore.setState({ isReconnecting: true })

		const { setConnected } = useConnectionStore.getState()
		setConnected(true)

		const state = useConnectionStore.getState()
		expect(state.isConnected).toBe(true)
		expect(state.isReconnecting).toBe(false)
	})

	it('should update state with setReconnecting', () => {
		const { setReconnecting } = useConnectionStore.getState()

		setReconnecting(true)

		const state = useConnectionStore.getState()
		expect(state.isReconnecting).toBe(true)
	})
})
