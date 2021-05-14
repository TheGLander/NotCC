import analyze from "rollup-plugin-analyzer"
import { terser } from "rollup-plugin-terser"
import typescript from "rollup-plugin-typescript2"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import path from "path"
import fs from "fs"

const production = process.env.NODE_ENV === "production"

const plugins = [
	resolve({ browser: true }),
	commonjs(),
	typescript({
		tsconfig: "./tsconfig.json",
		objectHashIgnoreUnknownHack: true,
	}),
	analyze({
		summaryOnly: true,
	}),
	production ? terser() : undefined,
]

function getFilesRecursive(dir) {
	const files = []
	fs.readdirSync(dir).forEach(file => {
		if (/\.d\.ts$/.test(file)) return
		const absolute = path.join(dir, file)
		if (fs.statSync(absolute).isDirectory())
			files.push(...getFilesRecursive(absolute))
		else files.push(absolute)
	})
	return files
}

//import banner from "rollup-plugin-banner"
export default [
	{
		input: ["./src/index.ts"],
		output: {
			name: "NotCC",
			file: "./dist/index.js",
			format: "umd",
			sourcemap: true,
		},
		plugins,
	},

	...(production
		? [
				{
					input: getFilesRecursive("./src").map(val => `./${val}`),
					output: {
						dir: "./dist/esm",
						format: "esm",
					},
					plugins,
				},
		  ]
		: []),
]
