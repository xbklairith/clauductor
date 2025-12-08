import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

export function MessageInput() {
	const [value, setValue] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const activeSessionId = useSessionStore((state) => state.activeSessionId)
	const sendMessage = useSessionStore((state) => state.sendMessage)
	const isSending = useSessionStore((state) => state.isSending)
	const error = useSessionStore((state) => state.error)
	const setError = useSessionStore((state) => state.setError)
	const isConnected = useConnectionStore((state) => state.isConnected)

	const disabled = !activeSessionId || !isConnected || isSending

	const handleSubmit = () => {
		if (value.trim() && activeSessionId && !disabled) {
			sendMessage(activeSessionId, value.trim())
			setValue('')
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to submit
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSubmit()
		}
	}

	// Auto-focus when session changes
	useEffect(() => {
		if (activeSessionId && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [activeSessionId])

	const placeholder = !activeSessionId
		? 'Select or create a session'
		: !isConnected
			? 'Waiting for connection...'
			: isSending
				? 'Sending...'
				: 'Type a message... (⌘+Enter to send)'

	return (
		<div className="border-t border-gray-700 p-4">
			{error && (
				<div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm flex justify-between items-center">
					<span>{error}</span>
					<button
						type="button"
						onClick={() => setError(null)}
						className="text-red-400 hover:text-red-200 ml-2"
					>
						✕
					</button>
				</div>
			)}
			{isSending && (
				<div className="mb-2 text-sm text-blue-400 animate-pulse">
					Waiting for response...
				</div>
			)}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				className={`
					w-full bg-gray-800 text-white p-3 rounded-lg
					border border-gray-700 focus:border-blue-500
					focus:ring-1 focus:ring-blue-500 outline-none
					resize-none disabled:opacity-50
					font-mono text-sm
				`}
				placeholder={placeholder}
				rows={3}
			/>
		</div>
	)
}
