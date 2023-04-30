import { protobuf } from "@notcc/logic"
import { compressToUTF16, decompressFromUTF16 } from "lz-string"
import { Settings } from "./settings"

// NOTE: This is structured this way so that the Neutralino-based Desktop
// version can swap out localStorage for native FS API seamlessly.

function makeFilePrefix(type: string) {
	return `NotCC ${type}`
}

const base64EncodedUI8Prefix = "\x7F\x00B64\x00\x7F"

function encodeBinaryBase64(bin: Uint8Array): string {
	return btoa(String.fromCharCode.apply(null, Array.from(bin)))
}

function decodeBinaryBase64(b64: string): Uint8Array {
	return Uint8Array.from(atob(b64), char => char.charCodeAt(0))
}

function jsonStringifyUI8(data: any): string {
	return JSON.stringify(data, (_key, val) =>
		val instanceof Uint8Array
			? `${base64EncodedUI8Prefix}${encodeBinaryBase64(val)}`
			: val
	)
}

function jsonParseUI8(data: any): string {
	return JSON.parse(data, (_key, val) =>
		typeof val === "string" && val.startsWith(base64EncodedUI8Prefix)
			? decodeBinaryBase64(val.slice(base64EncodedUI8Prefix.length))
			: val
	)
}

export async function saveSetInfo(
	solution: protobuf.ISetInfo,
	fileName: string
): Promise<void> {
	localStorage.setItem(
		`${makeFilePrefix("solution")}: ${fileName}`,
		compressToUTF16(jsonStringifyUI8(solution))
	)
}

export async function loadSetInfo(fileName: string): Promise<string> {
	const compressedData = localStorage.getItem(
		`${makeFilePrefix("solution")}: ${fileName}`
	)
	if (!compressedData) throw new Error(`File not fould: ${fileName}`)
	return jsonParseUI8(decompressFromUTF16(compressedData))
}

export async function saveSettings(settings: Settings): Promise<void> {
	localStorage.setItem(makeFilePrefix("settings"), JSON.stringify(settings))
}

export async function loadSettings(): Promise<Settings> {
	const settings = localStorage.getItem(makeFilePrefix("settings"))
	if (!settings) throw new Error("Settings file not found")
	return JSON.parse(settings)
}
