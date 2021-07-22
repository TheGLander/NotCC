import { terser } from "rollup-plugin-terser"
import typescript from "rollup-plugin-typescript2"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import nodePolyfills from "rollup-plugin-node-polyfills"
import copy from "rollup-plugin-copy"
import css from "rollup-plugin-css-porter"

const production = process.env.NODE_ENV === "production"

const plugins = [
	resolve({ browser: true, preferBuiltins: false }),
	commonjs(),
	nodePolyfills(),
	typescript({
		tsconfig: "./tsconfig.json",
	}),
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
		format: "umd",
		sourcemap: true,
	},
	preserveSymlinks: true,
	plugins,
	watch: { include: "src/**" },
}
