import { CLIArguments } from "./index"
import { errorAndExit } from "./helpers"
import fs from "fs"
import { parseC2M, parseDAT } from "@notcc/logic"

class DataType<T> {
	constructor(
		public validator: (fileBuffer: ArrayBuffer, filePath: string) => T,
		public logger: (data: T, filePath: string) => void
	) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dataTypes: DataType<any>[] = [
	new DataType(parseC2M, (data, path) => {
		console.log(
			`${path}:
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
	}),
	new DataType(parseDAT, (data, path) => {
		console.log(`${path}:
CC1 level set, named ${data.name}, has ${
			Object.keys(data.levels).length
		} levels`)
	}),
]

export function statFile(args: CLIArguments): void {
	if (!args.pos[1]) errorAndExit("Supply a file path!")

	for (const filePath of args.pos.slice(1)) {
		// This weird uint8 loop is because node is dumb
		const dataBuffer = new Uint8Array(fs.readFileSync(filePath, null)).buffer
		for (const dataType of dataTypes)
			try {
				const data = dataType.validator(dataBuffer, filePath)
				dataType.logger(data, filePath)
				break
				// eslint-disable-next-line no-empty
			} catch {}
	}
}
