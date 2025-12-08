import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { log } from '../utils/logger.js'

describe('logger', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	describe('log.info', () => {
		it('should output with blue marker', () => {
			log.info('Test message')

			expect(consoleSpy).toHaveBeenCalled()
			const output = consoleSpy.mock.calls[0][1]
			expect(output).toBe('Test message')
		})
	})

	describe('log.success', () => {
		it('should output with green marker', () => {
			log.success('Success message')

			expect(consoleSpy).toHaveBeenCalled()
			const output = consoleSpy.mock.calls[0][1]
			expect(output).toBe('Success message')
		})
	})

	describe('log.error', () => {
		it('should output with red marker', () => {
			log.error('Error message')

			expect(consoleSpy).toHaveBeenCalled()
			const output = consoleSpy.mock.calls[0][1]
			expect(output).toBe('Error message')
		})
	})

	describe('log.hint', () => {
		it('should output dim text', () => {
			log.hint('Hint message')

			expect(consoleSpy).toHaveBeenCalled()
		})
	})

	describe('log.warning', () => {
		it('should output with yellow marker', () => {
			log.warning('Warning message')

			expect(consoleSpy).toHaveBeenCalled()
			const output = consoleSpy.mock.calls[0][1]
			expect(output).toBe('Warning message')
		})
	})
})
