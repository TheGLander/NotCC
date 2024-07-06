import { ISetInfo, SetInfo } from "./nccs.pb.js"

export * as protobuf from "./nccs.pb.js"

const MAGIC_STRING = "NCCS"
const NCCS_VERSION = "1.0"

export function writeNCCS(saveData: ISetInfo): Uint8Array {
	const wireData = SetInfo.encode(saveData).finish()

	// The magic string + version
	const headerData = Uint8Array.from(
		`${MAGIC_STRING}todo${NCCS_VERSION}\u{0}`,
		char => char.charCodeAt(0)
	)

	headerData.set(
		// Get the length of the current version text, and write it as a uint32 spread across bytes
		new Uint8Array(new Uint32Array([NCCS_VERSION.length + 1]).buffer),
		4
	)

	const finalData = new Uint8Array(wireData.length + headerData.length)
	finalData.set(headerData)
	finalData.set(wireData, headerData.byteLength)

	return finalData
}

const MAGIC_STRING_AS_U32 =
	MAGIC_STRING.charCodeAt(0) * 0x1000000 +
	MAGIC_STRING.charCodeAt(1) * 0x10000 +
	MAGIC_STRING.charCodeAt(2) * 0x100 +
	MAGIC_STRING.charCodeAt(3) * 0x1

export function parseNCCS(data: ArrayBuffer): ISetInfo {
	const view = new DataView(data)
	const magicText = view.getUint32(0)
	if (magicText !== MAGIC_STRING_AS_U32) throw new Error("Missing magic string")

	const versionLength = view.getUint32(4)
	const versionString = new TextDecoder("utf-8").decode(
		data.slice(8, 8 + versionLength)
	)
	const [major] = versionString.split(".").map(segment => parseInt(segment, 10))
	if (major < 1)
		throw new Error("Pre-release versions of NCCS aren't supported")
	if (major > 1)
		throw new Error(
			`NCCS too new - parser version ${NCCS_VERSION}, file version ${versionString}`
		)
	const setInfo = SetInfo.decode(
		new Uint8Array(view.buffer.slice(8 + versionLength))
	)
	return setInfo.toJSON()
}
