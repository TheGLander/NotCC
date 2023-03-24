import AutoReadDataView from "./autoReader"
import { ISetInfo, SetInfo } from "./nccs.pb"

export * as protobuf from "./nccs.pb"

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
		new Uint8Array(new Uint32Array([NCCS_VERSION.length + 1]).buffer)
	)

	const finalData = new Uint8Array(wireData.length + headerData.length)
	finalData.set(headerData)
	finalData.set(wireData, headerData.byteLength)

	return finalData
}

export function parseNCCS(data: ArrayBuffer): SetInfo {
	const view = new AutoReadDataView(data)
	const magicText = view.getString(4)
	if (magicText !== MAGIC_STRING) throw new Error("Missing magic string")

	const versionLength = view.getUint32()
	const versionValue = view.getStringUntilNull()
	if (versionLength !== versionValue.length)
		throw new Error("Wrong header length")
	const [major] = versionValue.split(".").map(segment => parseInt(segment, 10))
	if (major < 1) throw new Error("Pre-release of NCCS aren't supported")
	if (major > 1)
		throw new Error(
			`NCCS too new - parser version ${NCCS_VERSION}, file version ${versionValue}`
		)
	const setInfo = SetInfo.decode(new Uint8Array(view.buffer.slice(view.offset)))
	return setInfo
}
