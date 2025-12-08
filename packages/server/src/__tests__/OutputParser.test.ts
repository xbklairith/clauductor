import { describe, expect, it, beforeEach } from 'vitest'
import { OutputParser } from '../services/OutputParser.js'

describe('OutputParser', () => {
	let parser: OutputParser

	beforeEach(() => {
		parser = new OutputParser()
	})

	describe('format detection', () => {
		it('should auto-detect JSON format from first line', () => {
			const chunk = '{"type":"text","content":"Hello"}\n'
			parser.parse(chunk)
			expect(parser.getMode()).toBe('json')
		})

		it('should auto-detect raw format from non-JSON', () => {
			const chunk = 'Hello, world!'
			parser.parse(chunk)
			expect(parser.getMode()).toBe('raw')
		})

		it('should use forced mode via setMode()', () => {
			parser.setMode('raw')
			const chunk = '{"type":"text","content":"Hello"}\n'
			const results = parser.parse(chunk)

			expect(parser.getMode()).toBe('raw')
			expect(results[0].type).toBe('raw')
		})
	})

	describe('JSON line parsing', () => {
		beforeEach(() => {
			parser.setMode('json')
		})

		it('should parse complete JSON line', () => {
			const chunk = '{"type":"text","content":"Hello"}\n'
			const results = parser.parse(chunk)

			expect(results).toHaveLength(1)
			expect(results[0].type).toBe('parsed')
			expect(results[0].event?.type).toBe('text')
		})

		it('should buffer incomplete JSON line', () => {
			const chunk1 = '{"type":"text",'
			const chunk2 = '"content":"Hello"}\n'

			const results1 = parser.parse(chunk1)
			expect(results1).toHaveLength(0)

			const results2 = parser.parse(chunk2)
			expect(results2).toHaveLength(1)
			expect(results2[0].event?.type).toBe('text')
		})

		it('should handle multiple lines in chunk', () => {
			const chunk = '{"type":"text","content":"Line 1"}\n{"type":"text","content":"Line 2"}\n'
			const results = parser.parse(chunk)

			expect(results).toHaveLength(2)
		})

		it('should map to ParsedEvent types', () => {
			const events = [
				{ input: '{"type":"text","content":"Hello"}\n', expected: 'text' },
				{ input: '{"type":"tool_use","name":"bash","input":{}}\n', expected: 'tool_use' },
				{ input: '{"type":"tool_result","output":"done"}\n', expected: 'tool_result' },
				{ input: '{"type":"thinking","content":"hmm"}\n', expected: 'thinking' },
				{ input: '{"type":"error","message":"oops"}\n', expected: 'error' },
			]

			for (const { input, expected } of events) {
				parser.reset()
				parser.setMode('json')
				const results = parser.parse(input)
				expect(results[0].event?.type).toBe(expected)
			}
		})
	})

	describe('malformed output handling', () => {
		it('should fall back to raw on malformed JSON', () => {
			parser.setMode('json')
			const chunk = 'not valid json\n'
			const results = parser.parse(chunk)

			expect(results).toHaveLength(1)
			expect(results[0].type).toBe('raw')
			expect(parser.getMode()).toBe('raw')
		})

		it('should preserve ANSI codes in raw mode', () => {
			parser.setMode('raw')
			const chunk = '\x1b[32mGreen text\x1b[0m'
			const results = parser.parse(chunk)

			expect(results[0].content).toBe('\x1b[32mGreen text\x1b[0m')
		})
	})

	describe('reset', () => {
		it('should clear buffer', () => {
			parser.setMode('json')
			parser.parse('{"incomplete":')
			parser.reset()

			// After reset, should be able to parse fresh
			const results = parser.parse('{"type":"text","content":"Fresh"}\n')
			expect(results).toHaveLength(1)
		})
	})
})
