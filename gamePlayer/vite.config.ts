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
		sourcemap: true,
	},
	base: "./",
	assetsInclude: ["**/*.c2m"],
	resolve: { alias: { path: "path-browserify" } },
})
