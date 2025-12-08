import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@clauductor/shared'

// Mock node-pty before importing modules that use it
vi.mock('node-pty', () => ({
	spawn: vi.fn(() => ({
		pid: 12345,
		onData: vi.fn(),
		onExit: vi.fn(),
		write: vi.fn(),
		resize: vi.fn(),
		kill: vi.fn(),
	})),
}))

import { VERSION, createServer, FileStorage, OutputParser } from '../index.js'

describe('Package exports', () => {
	it('should export VERSION', () => {
		expect(VERSION).toBe('0.1.0')
	})

	it('should export createServer', () => {
		expect(createServer).toBeDefined()
		expect(typeof createServer).toBe('function')
	})

	it('should export FileStorage', () => {
		expect(FileStorage).toBeDefined()
		const storage = new FileStorage()
		expect(storage.getDataDir()).toBeDefined()
	})

	it('should export OutputParser', () => {
		expect(OutputParser).toBeDefined()
		const parser = new OutputParser()
		expect(parser.getMode()).toBe('raw')
	})

	it('should import Session type from shared', () => {
		const session: Session = {
			id: 'test',
			name: 'Test',
			status: 'idle',
			workingDir: '/tmp',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}
		expect(session.id).toBe('test')
	})
})
