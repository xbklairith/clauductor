import * as pty from 'node-pty'
import { EventEmitter } from 'node:events'

export interface SpawnOptions {
	command: string
	args: string[]
	cwd: string
	env?: Record<string, string>
	cols?: number
	rows?: number
}

export interface ProcessHandle {
	id: string
	pid: number
	onData: (callback: (data: string) => void) => void
	onExit: (callback: (code: number, signal?: string) => void) => void
}

interface ManagedProcess {
	pty: pty.IPty
	emitter: EventEmitter
}

export class ProcessPool {
	private processes = new Map<string, ManagedProcess>()

	spawn(options: SpawnOptions): ProcessHandle {
		const id = crypto.randomUUID()

		const env = {
			...process.env,
			...options.env,
			TERM: 'xterm-256color',
		}

		const ptyProcess = pty.spawn(options.command, options.args, {
			name: 'xterm-256color',
			cols: options.cols || 80,
			rows: options.rows || 24,
			cwd: options.cwd,
			env,
		})

		const emitter = new EventEmitter()

		ptyProcess.onData((data: string) => {
			emitter.emit('data', data)
		})

		ptyProcess.onExit(({ exitCode, signal }) => {
			emitter.emit('exit', exitCode, signal)
			this.processes.delete(id)
		})

		this.processes.set(id, { pty: ptyProcess, emitter })

		return {
			id,
			pid: ptyProcess.pid,
			onData: (callback) => {
				emitter.on('data', callback)
			},
			onExit: (callback) => {
				emitter.on('exit', callback)
			},
		}
	}

	write(processId: string, data: string): void {
		const proc = this.processes.get(processId)
		if (proc) {
			proc.pty.write(data)
		}
	}

	resize(processId: string, cols: number, rows: number): void {
		const proc = this.processes.get(processId)
		if (proc) {
			proc.pty.resize(cols, rows)
		}
	}

	kill(processId: string): void {
		const proc = this.processes.get(processId)
		if (proc) {
			proc.pty.kill()
			this.processes.delete(processId)
		}
	}

	killAll(): void {
		for (const [id] of this.processes) {
			this.kill(id)
		}
	}

	getProcess(id: string): ProcessHandle | undefined {
		const proc = this.processes.get(id)
		if (!proc) return undefined

		return {
			id,
			pid: proc.pty.pid,
			onData: (callback) => {
				proc.emitter.on('data', callback)
			},
			onExit: (callback) => {
				proc.emitter.on('exit', callback)
			},
		}
	}
}
