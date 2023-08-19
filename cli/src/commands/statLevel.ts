import fs from "fs"
import { parseC2M } from "@notcc/logic"
import { ArgumentsCamelCase, Argv } from "yargs"

interface Options {
	files: string[]
}

export function statFile(args: ArgumentsCamelCase<Options>): void {
	for (const filePath of args.files) {
		// This weird uint8 loop is because node is dumb
		const dataBuffer = new Uint8Array(fs.readFileSync(filePath, null)).buffer

		const data = parseC2M(dataBuffer)
		console.log(
			`${filePath}:
CC2 level, ${data.name ? `named '${data.name}'` : "unnamed"}
Level size: ${data.width}x${data.height}, time limit: ${
				data.timeLimit === 0 ? "untimed" : data.timeLimit + "s"
			}${
				data.associatedSolution
					? `, has inline solution (${data.associatedSolution.steps?.[0].length} steps)`
					: ""
			}
Has a ${data.camera.width}x${data.camera.height} camera, blobs have ${
				data.blobMode ?? 1
			} seed${data.blobMode && data.blobMode !== 1 ? "s" : ""}`
		)
		break
	}
}

export default (yargs: Argv): Argv =>
	yargs.command<Options>(
		"stat <files>",
		"Gets stats about a level",
		yargs =>
			yargs
				.usage("Usage: $0 stat <files>")
				.positional("files", {
					describe: "The files to read",
					coerce: files => (files instanceof Array ? files : [files]),
				})
				.demandOption("files"),
		statFile
	)
