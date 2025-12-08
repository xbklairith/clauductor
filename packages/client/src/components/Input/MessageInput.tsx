import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useConnectionStore } from '../../stores/connectionStore.js'

export function MessageInput() {
	const [value, setValue] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const activeSessionId = useSessionStore((state) => state.activeSessionId)
	const sendMessage = useSessionStore((state) => state.sendMessage)
	const isConnected = useConnectionStore((state) => state.isConnected)

	const disabled = !activeSessionId || !isConnected

	const handleSubmit = () => {
		if (value.trim() && activeSessionId && !disabled) {
			sendMessage(activeSessionId, value.trim())
			setValue('')
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
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
			: 'Type a message... (Enter to send, Shift+Enter for newline)'

	return (
		<div className="border-t border-gray-700 p-4">
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
