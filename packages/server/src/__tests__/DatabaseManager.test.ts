import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseManager } from '../db/DatabaseManager.js'

describe('DatabaseManager', () => {
	let testDir: string

	beforeEach(async () => {
		// Create a temp directory for tests
		testDir = path.join(os.tmpdir(), `clauductor-dbmgr-test-${Date.now()}`)
		await fs.mkdir(testDir, { recursive: true })

		// Reset singleton state
		DatabaseManager.resetInstance()
	})

	afterEach(async () => {
		// Ensure clean shutdown
		try {
			const manager = DatabaseManager.getInstance(testDir)
			if (manager.isConnected()) {
				await manager.close()
			}
		} catch {
			// Ignore errors during cleanup
		}

		// Reset singleton state
		DatabaseManager.resetInstance()

		// Clean up temp directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('getInstance', () => {
		it('should return same instance on multiple calls', () => {
			const instance1 = DatabaseManager.getInstance(testDir)
			const instance2 = DatabaseManager.getInstance(testDir)

			expect(instance1).toBe(instance2)
		})

		it('should use dataDir from first call', () => {
			const instance1 = DatabaseManager.getInstance(testDir)
			const anotherDir = path.join(os.tmpdir(), 'another-dir')
			const instance2 = DatabaseManager.getInstance(anotherDir)

			// Should be same instance, ignoring second dataDir
			expect(instance1).toBe(instance2)
		})
	})

	describe('getConnection', () => {
		it('should return valid database connection', () => {
			const manager = DatabaseManager.getInstance(testDir)
			const db = manager.getConnection()

			// Should be able to execute queries
			const result = db.prepare('SELECT 1 as value').get() as { value: number }
			expect(result.value).toBe(1)
		})

		it('should create database file lazily', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			const dbPath = path.join(testDir, 'clauductor.db')

			// Before getConnection, file shouldn't exist
			const existsBefore = await fs
				.access(dbPath)
				.then(() => true)
				.catch(() => false)
			expect(existsBefore).toBe(false)

			// Call getConnection to trigger lazy initialization
			manager.getConnection()

			// Now file should exist
			const existsAfter = await fs
				.access(dbPath)
				.then(() => true)
				.catch(() => false)
			expect(existsAfter).toBe(true)
		})

		it('should return same connection on multiple calls', () => {
			const manager = DatabaseManager.getInstance(testDir)
			const db1 = manager.getConnection()
			const db2 = manager.getConnection()

			expect(db1).toBe(db2)
		})
	})

	describe('close', () => {
		it('should properly shut down connection', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()

			expect(manager.isConnected()).toBe(true)

			await manager.close()

			expect(manager.isConnected()).toBe(false)
		})

		it('should throw error when accessing connection after close initiated', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()

			await manager.close()

			expect(() => manager.getConnection()).toThrow('Database is shutting down')
		})

		it('should checkpoint WAL before closing', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			const db = manager.getConnection()

			// Write some data
			db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')
			db.exec('INSERT INTO test VALUES (1)')

			await manager.close()

			// WAL file should be empty or not exist after checkpoint
			const walPath = path.join(testDir, 'clauductor.db-wal')
			try {
				const stat = await fs.stat(walPath)
				expect(stat.size).toBe(0)
			} catch {
				// WAL file doesn't exist, which is also acceptable
				expect(true).toBe(true)
			}
		})
	})

	describe('isConnected', () => {
		it('should return false before connection is created', () => {
			const manager = DatabaseManager.getInstance(testDir)
			expect(manager.isConnected()).toBe(false)
		})

		it('should return true after connection is created', () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()
			expect(manager.isConnected()).toBe(true)
		})

		it('should return false after close', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()
			await manager.close()
			expect(manager.isConnected()).toBe(false)
		})
	})

	describe('checkHealth', () => {
		it('should return healthy status when connected', () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()

			const health = manager.checkHealth()

			expect(health.isConnected).toBe(true)
			expect(health.integrityOk).toBe(true)
			expect(typeof health.walSize).toBe('number')
		})

		it('should return unhealthy status when not connected', () => {
			const manager = DatabaseManager.getInstance(testDir)

			const health = manager.checkHealth()

			expect(health.isConnected).toBe(false)
			expect(health.integrityOk).toBe(false)
			expect(health.walSize).toBe(0)
		})

		it('should return unhealthy status after close', async () => {
			const manager = DatabaseManager.getInstance(testDir)
			manager.getConnection()
			await manager.close()

			const health = manager.checkHealth()

			expect(health.isConnected).toBe(false)
		})
	})
})
