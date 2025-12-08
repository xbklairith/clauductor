import type { ParsedEvent } from '@clauductor/shared'

export interface ParsedOutput {
	type: 'raw' | 'parsed'
	content: string
	event?: ParsedEvent
}

export type OutputMode = 'auto' | 'raw' | 'json'

export class OutputParser {
	private mode: OutputMode = 'auto'
	private detectedMode: 'raw' | 'json' | null = null
	private lineBuffer = ''

	setMode(mode: OutputMode): void {
		this.mode = mode
		if (mode !== 'auto') {
			this.detectedMode = mode
		}
	}

	getMode(): 'raw' | 'json' {
		return this.detectedMode || 'raw'
	}

	reset(): void {
		this.lineBuffer = ''
		if (this.mode === 'auto') {
			this.detectedMode = null
		}
	}

	parse(chunk: string): ParsedOutput[] {
		const results: ParsedOutput[] = []

		// If mode is forced to raw, return as-is
		if (this.mode === 'raw') {
			this.detectedMode = 'raw'
			results.push({ type: 'raw', content: chunk })
			return results
		}

		// Auto-detect on first chunk
		if (this.mode === 'auto' && this.detectedMode === null) {
			this.detectedMode = this.detectFormat(chunk)
		}

		// If detected as raw, return as-is
		if (this.detectedMode === 'raw') {
			results.push({ type: 'raw', content: chunk })
			return results
		}

		// JSON mode: parse line by line
		this.lineBuffer += chunk
		const lines = this.lineBuffer.split('\n')

		// Keep the last incomplete line in buffer
		this.lineBuffer = lines.pop() || ''

		for (const line of lines) {
			if (line.trim()) {
				const parsed = this.parseLine(line)
				if (parsed) {
					results.push(parsed)
				}
			}
		}

		return results
	}

	private detectFormat(chunk: string): 'raw' | 'json' {
		const trimmed = chunk.trim()
		if (trimmed.startsWith('{')) {
			try {
				// Try to find a complete JSON line
				const firstLine = trimmed.split('\n')[0]
				JSON.parse(firstLine)
				return 'json'
			} catch {
				// Not valid JSON, use raw mode
				return 'raw'
			}
		}
		return 'raw'
	}

	private parseLine(line: string): ParsedOutput | null {
		try {
			const json = JSON.parse(line)
			const event = this.mapToEvent(json)
			return {
				type: 'parsed',
				content: line,
				event,
			}
		} catch {
			// Malformed JSON, fall back to raw
			this.detectedMode = 'raw'
			return { type: 'raw', content: line }
		}
	}

	private mapToEvent(json: Record<string, unknown>): ParsedEvent {
		// Map Claude CLI stream-json events to our ParsedEvent type
		const eventType = json.type as string

		switch (eventType) {
			case 'assistant':
			case 'text':
			case 'content_block_delta':
				return {
					type: 'text',
					content: this.extractTextContent(json),
				}

			case 'tool_use':
			case 'tool_use_block':
				return {
					type: 'tool_use',
					tool: (json.name as string) || (json.tool as string) || 'unknown',
					input: json.input || json.arguments || {},
				}

			case 'tool_result':
			case 'tool_result_block':
				return {
					type: 'tool_result',
					output: (json.output as string) || (json.content as string) || '',
				}

			case 'thinking':
				return {
					type: 'thinking',
					content: (json.content as string) || (json.thinking as string) || '',
				}

			case 'error':
				return {
					type: 'error',
					message: (json.message as string) || (json.error as string) || 'Unknown error',
				}

			default:
				// Unknown event type, treat as text
				return {
					type: 'text',
					content: JSON.stringify(json),
				}
		}
	}

	private extractTextContent(json: Record<string, unknown>): string {
		// Handle various text content formats from Claude CLI
		if (typeof json.content === 'string') {
			return json.content
		}
		if (typeof json.text === 'string') {
			return json.text
		}
		if (json.delta && typeof (json.delta as Record<string, unknown>).text === 'string') {
			return (json.delta as Record<string, unknown>).text as string
		}
		return JSON.stringify(json)
	}
}
