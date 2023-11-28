/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				theme: Object.fromEntries(
					[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(
						colorShade => [
							colorShade,
							`rgb(var(--theme-${colorShade}) / <alpha-value>)`,
						]
					)
				),
			},
		},
	},
	plugins: [],
}
