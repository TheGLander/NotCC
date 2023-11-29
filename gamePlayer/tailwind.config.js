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
			animation: {
				"tooltip-open": "0.1s ease-in-out tooltip-reveal",
				"tooltip-close": "0.1s ease-in-out tooltip-reveal reverse",
				"drawer-open": "0.05s ease-in-out drawer-reveal",
				"drawer-close": "0.05s ease-in-out drawer-reveal reverse",
			},
			keyframes: {
				"tooltip-reveal": {
					from: {
						transform: "scale(0.4)",
						opacity: "0",
					},
					to: {
						transform: "scale(1)",
						opacity: "1",
					},
				},
				"drawer-reveal": {
					from: {
						opacity: 0.7,
						transform: "scaleY(0%)",
					},
					to: {
						opacity: 1,
						transform: "scaleY(100%)",
					},
				},
			},
		},
	},
	plugins: [],
}
