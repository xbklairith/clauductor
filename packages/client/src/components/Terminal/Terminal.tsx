import { useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useTerminal } from './useTerminal.js'

interface TerminalProps {
	sessionId: string | null
}

export function Terminal({ sessionId }: TerminalProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const { write, clear, fit } = useTerminal(containerRef)
	const outputBuffer = useSessionStore((state) => state.outputBuffer)
	const lastOutputLengthRef = useRef<number>(0)
	const currentSessionIdRef = useRef<string | null>(null)

	// Handle session change
	useEffect(() => {
		if (currentSessionIdRef.current !== sessionId) {
			clear()
			currentSessionIdRef.current = sessionId
			lastOutputLengthRef.current = 0

			// If switching to a session with existing output, replay it
			if (sessionId) {
				const output = outputBuffer.get(sessionId) ?? []
				for (const item of output) {
					write(item.content)
				}
				lastOutputLengthRef.current = output.length
			}
		}
	}, [sessionId, clear, write, outputBuffer])

	// Handle new output
	useEffect(() => {
		if (!sessionId) return

		const output = outputBuffer.get(sessionId) ?? []
		const newItems = output.slice(lastOutputLengthRef.current)

		for (const item of newItems) {
			write(item.content)
		}

		lastOutputLengthRef.current = output.length
	}, [sessionId, outputBuffer, write])

	// Fit on mount
	useEffect(() => {
		fit()
	}, [fit])

	if (!sessionId) {
		return (
			<div className="flex-1 bg-[#0d1117] flex items-center justify-center text-gray-500">
				Select or create a session to get started
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			data-testid="terminal-output"
			className="flex-1 bg-[#0d1117] overflow-hidden"
		/>
	)
}
