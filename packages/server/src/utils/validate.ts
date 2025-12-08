import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

interface ValidationResult {
	ok: boolean
	message?: string
	hint?: string
}

interface ValidationResults {
	claudeCli: ValidationResult
	all: boolean
}

export async function checkClaudeCli(): Promise<ValidationResult> {
	try {
		await execAsync('claude --version', { timeout: 5000 })
		return { ok: true }
	} catch {
		return {
			ok: false,
			message: 'Claude CLI not found',
			hint: 'Install with: npm install -g @anthropic-ai/claude-cli',
		}
	}
}

export async function validateEnvironment(): Promise<ValidationResults> {
	const claudeCli = await checkClaudeCli()

	return {
		claudeCli,
		all: claudeCli.ok,
	}
}
