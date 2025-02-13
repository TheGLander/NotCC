#!/usr/bin/env zx

import "zx/globals"
import { initWasm, makeLinearLevels } from "./libnotcc-bind/dist/index.js"

const setsDir = argv["sets"]

if (!setsDir) {
	console.error("Must supply --sets!")
	process.exit(1)
}

await initWasm()

for (const setEnt of await fs.readdir(setsDir)) {
	if (setEnt === "." || setEnt === "..") continue
	const setDir = path.join(setsDir, setEnt)
	if (!(await fs.stat(setDir)).isDirectory()) continue
	const allFiles = await fs.readdir(setDir, { recursive: true })
	async function loaderFunction(initPath, binary) {
		const truePath = allFiles.find(
			pth => pth.toLowerCase() == initPath.toLowerCase()
		)
		return await fs.readFile(
			path.join(setDir, path.normalize("/" + truePath)),
			binary ? null : "utf-8"
		)
	}
	for (const setFile of await fs.readdir(setDir)) {
		if (!setFile.endsWith(".c2g")) continue
		const linearLevels = await makeLinearLevels({
			scriptFile: setFile,
			loaderFunction,
		})
		if (linearLevels === null) {
			console.log(`Failed to linearize ${setEnt}/${setFile}`)
		} else {
			//	console.log(
			//				`Linearized ${setEnt}/${setFile} with ${linearLevels.length} levels`
			//		)
		}
	}
}
