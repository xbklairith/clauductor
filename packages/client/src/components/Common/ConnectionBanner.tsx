import { useConnectionStore } from '../../stores/connectionStore.js'

export function ConnectionBanner() {
	const isConnected = useConnectionStore((state) => state.isConnected)
	const isReconnecting = useConnectionStore((state) => state.isReconnecting)

	if (isConnected) return null

	return (
		<div
			className="bg-red-900/80 text-white px-4 py-2 text-center text-sm transition-all duration-300"
			role="alert"
		>
			{isReconnecting
				? '⟳ Reconnecting to server...'
				: '⚠ Disconnected from server'}
		</div>
	)
}
