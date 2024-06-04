import { execSync } from "child_process"
import { join } from "path"
import { PluginOption, defineConfig } from "vite"
import preact from "@preact/preset-vite"
import { VitePWA } from "vite-plugin-pwa"
import { readFileSync } from "fs"
import jotaiDebugLabel from "jotai/babel/plugin-debug-label"
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh"

process.env["VITE_LAST_COMMIT_INFO"] = execSync(
	`git log -1 --format="%s (%h) at %cI"`
)
	.toString("utf-8")
	.trim()

process.env["VITE_VERSION"] = execSync('git log -1 --format="%h"')
	.toString("utf-8")
	.trim()

process.env["VITE_BUILD_TIME"] = new Date().toISOString()

const SSG_PLACEHOLDER_STRING = "<!-- SSG here -->"
const SSG_FAKE_ASSET_PATH = "/FAKE_ASSET_PATH_TEMP_TO_REPLACE"

function ssg(): PluginOption {
	return {
		name: "notcc-ssg",
		async transformIndexHtml(html) {
			// The useless `.slice` is here to stop Typescript from resolving the path
			// at build time, which will create a silly error when it's not present
			const mainModule = await import("./dist/ssg/main-ssg.js".slice())
			const prerenderedHtml = mainModule.renderSsgString()
			return html
				.replace(SSG_PLACEHOLDER_STRING, prerenderedHtml)
				.replaceAll(SSG_FAKE_ASSET_PATH, ".")
		},
	}
}

const prodBuild = !process.env.SSG && process.env.NODE_ENV === "production"

export default defineConfig({
	plugins: [
		preact({ babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] } }),
		VitePWA({
			registerType: "prompt",
			workbox: {
				globIgnores: ["**/ssg/**/*", "**/node_modules/**/*"],
				globPatterns: ["**/*.{js,css,html,png,svg,wav,ogg,mp3,gif}"],
			},
			manifest: JSON.parse(
				readFileSync("./public/manifest.webmanifest").toString("utf-8")
			),
		}),
		prodBuild && ssg(),
	],
	base: process.env.SSG ? SSG_FAKE_ASSET_PATH : "./",
	assetsInclude: ["**/*.c2m"],
	resolve: {
		alias: {
			path: join(process.cwd(), "node_modules/path-browserify"),
			"@": "/src",
		},
	},
	ssr: process.env.SSG ? { noExternal: new RegExp("", "g") } : {},
	esbuild: { sourcemap: true },
	build: { sourcemap: true, emptyOutDir: !prodBuild },
})
