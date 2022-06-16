import { terser } from "rollup-plugin-terser"
import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import nodePolyfills from "rollup-plugin-polyfill-node"
import copy from "rollup-plugin-copy"
import sourceMaps from "rollup-plugin-sourcemaps"
import css from "rollup-plugin-css-porter"

const production = process.env.NODE_ENV === "production"

const plugins = [
	typescript({
		tsconfig: "./tsconfig.json",
	}),
	nodePolyfills(),
	resolve({ browser: true, preferBuiltins: true }),
	sourceMaps(),
	commonjs(),
	css({ minify: false }),
	production ? terser() : undefined,
	copy({
		targets: [
			{ src: "src/data", dest: "dist" },
			{ src: "src/index.html", dest: "dist" },
		],
	}),
]

export default {
	input: ["./src/index.ts"],
	output: {
		name: "NotCC",
		file: "./dist/index.js",
		format: "iife",
		sourcemap: true,
	},
	preserveSymlinks: true,
	plugins,
}
