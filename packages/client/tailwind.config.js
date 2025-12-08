/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				terminal: {
					bg: '#0d1117',
					fg: '#c9d1d9',
				},
			},
			fontFamily: {
				mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
			},
		},
	},
	plugins: [],
}
