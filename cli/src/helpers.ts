import fs from "fs"
import path from "path"
import { exit } from "process"

export function getFilesRecursive(dir: string): string[] {
	const files: string[] = []
	fs.readdirSync(dir).forEach(file => {
		const absolute = path.join(dir, file)
		if (fs.statSync(absolute).isDirectory())
			files.push(...getFilesRecursive(absolute))
		else files.push(absolute)
	})
	return files
}

export function resolveLevelPath(...levelPaths: string[]): string[] {
	const values: string[] = []
	for (const levelPath of levelPaths) {
		const inputPath = path.resolve(process.cwd(), levelPath)
		if (fs.statSync(inputPath).isDirectory())
			values.push(
				...getFilesRecursive(inputPath).map(levelPath =>
					path.resolve(inputPath, levelPath)
				)
			)
		else values.push(inputPath)
	}
	return values
}

export function errorAndExit(errorName = "", errorCode = 1): void {
	if (errorName) console.error(errorName)
	exit(errorCode)
}
