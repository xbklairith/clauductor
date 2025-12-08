import { createServer, type Server } from 'node:net'
import { describe, expect, it, afterEach } from 'vitest'
import { checkPort, suggestNextPort, isValidPort } from '../utils/port.js'

describe('port utilities', () => {
	let serverToCleanup: Server | null = null

	afterEach(() => {
		if (serverToCleanup) {
			serverToCleanup.close()
			serverToCleanup = null
		}
	})

	describe('checkPort', () => {
		it('should return true for available port', async () => {
			// Use a high random port that's likely available
			const port = 50000 + Math.floor(Math.random() * 10000)
			const result = await checkPort(port)

			expect(result).toBe(true)
		})

		it('should return false for in-use port', async () => {
			// Create a server on a random port
			const port = 50000 + Math.floor(Math.random() * 10000)
			serverToCleanup = createServer()

			await new Promise<void>((resolve) => {
				serverToCleanup?.listen(port, '127.0.0.1', () => resolve())
			})

			const result = await checkPort(port)
			expect(result).toBe(false)
		})
	})

	describe('suggestNextPort', () => {
		it('should find next available port', async () => {
			const startPort = 50000 + Math.floor(Math.random() * 10000)
			const result = await suggestNextPort(startPort)

			expect(result).toBeGreaterThan(startPort)
			expect(result).toBeLessThanOrEqual(startPort + 10)
		})
	})

	describe('isValidPort', () => {
		it('should return true for valid ports', () => {
			expect(isValidPort(1)).toBe(true)
			expect(isValidPort(80)).toBe(true)
			expect(isValidPort(3000)).toBe(true)
			expect(isValidPort(65535)).toBe(true)
		})

		it('should return false for invalid ports', () => {
			expect(isValidPort(0)).toBe(false)
			expect(isValidPort(-1)).toBe(false)
			expect(isValidPort(65536)).toBe(false)
			expect(isValidPort(1.5)).toBe(false)
		})
	})
})
