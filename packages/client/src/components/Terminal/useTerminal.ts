import { useRef, useEffect, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface UseTerminalResult {
	write: (data: string) => void
	clear: () => void
	fit: () => void
}

export function useTerminal(
	containerRef: React.RefObject<HTMLDivElement | null>,
): UseTerminalResult {
	const terminalRef = useRef<XTerm | null>(null)
	const fitAddonRef = useRef<FitAddon | null>(null)

	useEffect(() => {
		if (!containerRef.current) return

		const terminal = new XTerm({
			theme: {
				background: '#0d1117',
				foreground: '#c9d1d9',
				cursor: '#58a6ff',
				cursorAccent: '#0d1117',
				selectionBackground: '#3392FF44',
				black: '#484f58',
				red: '#ff7b72',
				green: '#3fb950',
				yellow: '#d29922',
				blue: '#58a6ff',
				magenta: '#bc8cff',
				cyan: '#39c5cf',
				white: '#b1bac4',
				brightBlack: '#6e7681',
				brightRed: '#ffa198',
				brightGreen: '#56d364',
				brightYellow: '#e3b341',
				brightBlue: '#79c0ff',
				brightMagenta: '#d2a8ff',
				brightCyan: '#56d4dd',
				brightWhite: '#f0f6fc',
			},
			fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
			fontSize: 14,
			scrollback: 10000,
			cursorBlink: true,
			convertEol: true,
		})

		const fitAddon = new FitAddon()
		terminal.loadAddon(fitAddon)
		terminal.open(containerRef.current)
		fitAddon.fit()

		terminalRef.current = terminal
		fitAddonRef.current = fitAddon

		// Resize handler
		const handleResize = () => {
			if (fitAddonRef.current) {
				fitAddonRef.current.fit()
			}
		}

		window.addEventListener('resize', handleResize)

		return () => {
			window.removeEventListener('resize', handleResize)
			terminal.dispose()
			terminalRef.current = null
			fitAddonRef.current = null
		}
	}, [containerRef])

	const write = useCallback((data: string) => {
		if (terminalRef.current) {
			terminalRef.current.write(data)
			// Auto-scroll to bottom after writing
			terminalRef.current.scrollToBottom()
		}
	}, [])

	const clear = useCallback(() => {
		terminalRef.current?.clear()
	}, [])

	const fit = useCallback(() => {
		fitAddonRef.current?.fit()
	}, [])

	return { write, clear, fit }
}
