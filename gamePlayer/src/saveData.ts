import { protobuf } from "@notcc/logic"
import { compressToUTF16, decompressFromUTF16 } from "lz-string"

// NOTE: This is structured this way so that the Neutralino-based Desktop
// version can swap out localStorage for native FS API seamlessly.

function makeFilePrefix(type: string) {
	return `NotCC ${type}: `
}

export function saveSolution(
	solution: protobuf.ISetInfo,
	fileName: string
): Promise<void> {
	localStorage.setItem(
		`${makeFilePrefix("solution")}${fileName}`,
		compressToUTF16(JSON.stringify(solution))
	)
	return Promise.resolve()
}

export function loadSolution(fileName: string): Promise<string> {
	const compressedData = localStorage.getItem(
		`${makeFilePrefix("solution")}${fileName}`
	)
	if (!compressedData) throw new Error(`File not fould: ${fileName}`)
	return Promise.resolve(JSON.parse(decompressFromUTF16(compressedData)))
}
