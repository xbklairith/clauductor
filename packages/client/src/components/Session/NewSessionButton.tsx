import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

export function NewSessionButton() {
	const createSession = useSessionStore((state) => state.createSession)
	const isLoading = useSessionStore((state) => state.isLoading)
	const isConnected = useConnectionStore((state) => state.isConnected)

	const disabled = !isConnected || isLoading

	const handleClick = () => {
		if (!disabled) {
			createSession()
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			data-testid="new-session-button"
			className={`
				w-full py-2 px-4 rounded-lg font-medium
				transition-colors cursor-pointer
				${disabled
					? 'bg-gray-700 text-gray-500 cursor-not-allowed'
					: 'bg-blue-600 text-white hover:bg-blue-500'
				}
			`}
		>
			{isLoading ? (
				<span className="flex items-center justify-center gap-2">
					<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
					Creating...
				</span>
			) : (
				'+ New Session'
			)}
		</button>
	)
}
