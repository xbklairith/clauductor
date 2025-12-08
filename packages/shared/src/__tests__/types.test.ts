import { describe, expect, it } from 'vitest'
import type { CreateSessionOptions, ParsedEvent, Session, SessionOutput } from '../index'

describe('Session type', () => {
	it('should have required properties', () => {
		const session: Session = {
			id: 'test-id',
			name: 'Test Session',
			status: 'idle',
			workingDir: '/tmp',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}

		expect(session.id).toBe('test-id')
		expect(session.name).toBe('Test Session')
		expect(session.status).toBe('idle')
		expect(session.workingDir).toBe('/tmp')
		expect(session.createdAt).toBeDefined()
		expect(session.updatedAt).toBeDefined()
	})

	it('should accept all valid status values', () => {
		const statuses: Session['status'][] = ['idle', 'running', 'error']
		expect(statuses).toHaveLength(3)
	})
})

describe('SessionOutput type', () => {
	it('should support raw output', () => {
		const output: SessionOutput = {
			sessionId: 'test-id',
			type: 'raw',
			content: 'Hello, world!',
			timestamp: Date.now(),
		}

		expect(output.type).toBe('raw')
		expect(output.event).toBeUndefined()
	})

	it('should support parsed output with event', () => {
		const event: ParsedEvent = { type: 'text', content: 'Hello' }
		const output: SessionOutput = {
			sessionId: 'test-id',
			type: 'parsed',
			content: 'Hello',
			event,
			timestamp: Date.now(),
		}

		expect(output.type).toBe('parsed')
		expect(output.event).toBeDefined()
	})
})

describe('CreateSessionOptions type', () => {
	it('should allow optional properties', () => {
		const options: CreateSessionOptions = {}
		expect(options.name).toBeUndefined()
		expect(options.workingDir).toBeUndefined()
	})

	it('should accept name and workingDir', () => {
		const options: CreateSessionOptions = {
			name: 'My Session',
			workingDir: '/home/user/project',
		}
		expect(options.name).toBe('My Session')
		expect(options.workingDir).toBe('/home/user/project')
	})
})

describe('ParsedEvent type', () => {
	it('should support all event types', () => {
		const events: ParsedEvent[] = [
			{ type: 'text', content: 'Hello' },
			{ type: 'tool_use', tool: 'bash', input: { command: 'ls' } },
			{ type: 'tool_result', output: 'file.txt' },
			{ type: 'thinking', content: 'Analyzing...' },
			{ type: 'error', message: 'Something went wrong' },
		]

		expect(events).toHaveLength(5)
	})
})
