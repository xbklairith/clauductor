import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Get the default data directory following XDG Base Directory specification.
 *
 * Priority:
 * 1. XDG_DATA_HOME environment variable
 * 2. Platform-specific defaults:
 *    - macOS: ~/Library/Application Support/clauductor
 *    - Windows: %APPDATA%/clauductor
 *    - Linux/Others: ~/.local/share/clauductor
 *
 * @returns Absolute path to data directory
 */
export function getDataDir(): string {
	const xdgDataHome = process.env.XDG_DATA_HOME
	const home = process.env.HOME || os.homedir()

	if (xdgDataHome) {
		return path.join(xdgDataHome, 'clauductor')
	}

	if (process.platform === 'darwin') {
		return path.join(home, 'Library', 'Application Support', 'clauductor')
	}

	if (process.platform === 'win32') {
		return path.join(process.env.APPDATA || home, 'clauductor')
	}

	// Linux and other Unix-like systems
	return path.join(home, '.local', 'share', 'clauductor')
}

/**
 * Get the path to the database file.
 *
 * @param dataDir - Optional custom data directory
 * @returns Absolute path to database file
 */
export function getDatabasePath(dataDir?: string): string {
	const dir = dataDir ?? getDataDir()
	return path.join(dir, 'clauductor.db')
}

/**
 * Result of permission check.
 */
export interface PermissionCheckResult {
	ok: boolean
	message: string
}

/**
 * Check if directory permissions are secure (not world-readable).
 *
 * @param dirPath - Directory path to check
 * @returns Result indicating if permissions are acceptable
 */
export async function checkDirectoryPermissions(dirPath: string): Promise<PermissionCheckResult> {
	try {
		const stats = await fs.stat(dirPath)

		if (!stats.isDirectory()) {
			return { ok: false, message: `Path ${dirPath} is not a directory` }
		}

		// On Unix-like systems, check for world-readable permissions
		if (process.platform !== 'win32') {
			const mode = stats.mode
			// Check if others have any permissions (world-readable/writable/executable)
			const othersPermissions = mode & 0o007 // Last 3 bits are "others" permissions

			if (othersPermissions !== 0) {
				return {
					ok: false,
					message: `Directory ${dirPath} has too permissive permissions (world-readable). Consider running: chmod 700 "${dirPath}"`,
				}
			}
		}

		return { ok: true, message: 'Permissions OK' }
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { ok: false, message: `Directory ${dirPath} does not exist` }
		}
		return {
			ok: false,
			message: `Cannot check permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}
