import { defineConfig } from "vite"
import { join } from "path"

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
	resolve: {
		alias: { path: join(process.cwd(), "node_modules/path-browserify") },
	},
	esbuild: { sourcemap: false },
})
