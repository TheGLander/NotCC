import { defineConfig } from "vite"
import { join } from "path"
import { execSync } from "child_process"

process.env["VITE_LAST_COMMIT_INFO"] = execSync(
	`git log -1 --format="%s (%h) at %cI"`
)
	.toString("utf-8")
	.trim()

process.env["VITE_VERSION"] = execSync('git log -1 --format="%h"')
	.toString("utf-8")
	.trim()

process.env["VITE_BUILD_TIME"] = new Date().toISOString()

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
