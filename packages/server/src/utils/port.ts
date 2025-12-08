import { createServer } from 'node:net'

export async function checkPort(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer()

		server.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
				resolve(false)
			} else {
				resolve(false)
			}
		})

		server.once('listening', () => {
			server.close()
			resolve(true)
		})

		server.listen(port, '127.0.0.1')

		// Timeout after 1 second
		setTimeout(() => {
			server.close()
			resolve(false)
		}, 1000)
	})
}

export async function suggestNextPort(startPort: number, maxAttempts = 10): Promise<number | null> {
	for (let i = 1; i <= maxAttempts; i++) {
		const port = startPort + i
		if (await checkPort(port)) {
			return port
		}
	}
	return null
}

export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 65535
}
