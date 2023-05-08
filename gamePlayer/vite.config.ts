import { defineConfig } from "vite"
import { join } from "path"

export default defineConfig({
	build: {
		sourcemap: true,
	},
	base: "./",
	assetsInclude: ["**/*.c2m"],
	resolve: {
		alias: { path: join(process.cwd(), "node_modules/path-browserify") },
	},
	esbuild: { sourcemap: true },
})
