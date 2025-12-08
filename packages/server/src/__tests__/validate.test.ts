import { describe, expect, it } from 'vitest'
import { checkClaudeCli, validateEnvironment } from '../utils/validate.js'

describe('validate utilities', () => {
	describe('checkClaudeCli', () => {
		it('should return a ValidationResult object', async () => {
			const result = await checkClaudeCli()

			expect(result).toHaveProperty('ok')
			expect(typeof result.ok).toBe('boolean')
		})

		it('should include hint when Claude CLI is not found', async () => {
			const result = await checkClaudeCli()

			// If not ok, should have hint
			if (!result.ok) {
				expect(result.hint).toBeDefined()
				expect(result.message).toBeDefined()
			}
		})
	})

	describe('validateEnvironment', () => {
		it('should return ValidationResults with all checks', async () => {
			const result = await validateEnvironment()

			expect(result).toHaveProperty('claudeCli')
			expect(result).toHaveProperty('all')
			expect(typeof result.all).toBe('boolean')
		})

		it('should set all to true only if all checks pass', async () => {
			const result = await validateEnvironment()

			// all should match claudeCli.ok
			expect(result.all).toBe(result.claudeCli.ok)
		})
	})
})
