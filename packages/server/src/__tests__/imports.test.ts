import { describe, expect, it } from 'vitest'
import type { Session } from '@clauductor/shared'
import { VERSION } from '../index'

describe('Cross-package imports', () => {
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

	it('should export VERSION', () => {
		expect(VERSION).toBe('0.1.0')
	})
})
