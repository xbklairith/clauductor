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
