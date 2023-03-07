import { defineConfig } from "vite"

export default defineConfig({
	optimizeDeps: {
		include: ["@notcc/logic"],
		disabled: false,
	},
	build: {
		commonjsOptions: {
			include: [],
		},
	},
	base: "./",
	assetsInclude: ["**/*.c2m"],
})
