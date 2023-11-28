import { execSync } from "child_process"
import { join } from "path"
import { PluginOption, defineConfig } from "vite"
import preact from "@preact/preset-vite"

process.env["VITE_LAST_COMMIT_INFO"] = execSync(
	`git log -1 --format="%s (%h) at %cI"`
)
	.toString("utf-8")
	.trim()

process.env["VITE_VERSION"] = execSync('git log -1 --format="%h"').toString(
	"utf-8"
)

process.env["VITE_BUILD_TIME"] = new Date().toISOString()

const SSG_PLACEHOLDER_STRING = "<!-- SSG here -->"

function ssg(): PluginOption {
	return {
		name: "notcc-ssg",
		async transformIndexHtml(html) {
			// The useless `.slice` is here to stop Typescript from resolving the path
			// at build time, which will create a silly error when it's not present
			const mainModule = await import("./dist/ssg/main-ssg.js".slice())
			const prerenderedHtml = mainModule.renderSsgString()
			return html.replace(SSG_PLACEHOLDER_STRING, prerenderedHtml)
		},
	}
}

const prodBuild = !process.env.SSG && process.env.NODE_ENV === "production"

export default defineConfig({
	plugins: [preact(), prodBuild && ssg()],
	base: "./",
	assetsInclude: ["**/*.c2m"],
	resolve: {
		alias: {
			path: join(process.cwd(), "node_modules/path-browserify"),
			"@": "./src",
		},
	},
	esbuild: { sourcemap: true },
	build: { sourcemap: true, emptyOutDir: !prodBuild },
})
