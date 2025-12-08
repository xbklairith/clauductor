// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	blue: '\x1b[34m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	dim: '\x1b[2m',
	yellow: '\x1b[33m',
	bold: '\x1b[1m',
}

// Check if colors should be disabled
const noColor = process.env.NO_COLOR !== undefined || process.env.TERM === 'dumb'

function colorize(color: keyof typeof colors, text: string): string {
	if (noColor) return text
	return `${colors[color]}${text}${colors.reset}`
}

export const log = {
	info(message: string): void {
		console.log(colorize('blue', '●'), message)
	},

	success(message: string): void {
		console.log(colorize('green', '✓'), message)
	},

	error(message: string): void {
		console.log(colorize('red', '✗'), message)
	},

	warning(message: string): void {
		console.log(colorize('yellow', '⚠'), message)
	},

	hint(message: string): void {
		console.log(colorize('dim', `  ${message}`))
	},

	title(message: string): void {
		console.log()
		console.log(colorize('bold', message))
	},

	raw(message: string): void {
		console.log(message)
	},
}
