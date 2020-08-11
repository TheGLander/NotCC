import AutoReadDataView from "./autoReader"
import { LevelData } from "../encoder"
import { WatchIgnorePlugin } from "webpack"

// Optional.   Show the copy icon when dragging over.  Seems to only work for chrome.
document.addEventListener("dragover", e => {
	e.stopPropagation()
	e.preventDefault()
	e.dataTransfer.dropEffect = "copy"
})

// Get file data on drop
document.addEventListener("drop", async e => {
	e.stopPropagation()
	e.preventDefault()
	const file = e.dataTransfer.files[0]
	const buffer = await file.arrayBuffer()
	parseC2M(buffer)
})

function parseC2M(buff: ArrayBuffer): LevelData {
	const view = new AutoReadDataView(buff)
	const data: LevelData = {
		field: null,
		width: null,
		height: null,
		camera: {
			height: 10,
			width: 10,
			screens: 1,
		},
		extUsed: ["cc", "cc2"],
		timeLimit: 0,
		blobMode: "1",
	}
	const OPTNFuncs = [
		() => {
			data.timeLimit = view.getUint16()
		},
		() => {
			const camMode = view.getUint8()
			switch (camMode) {
				case 0:
					data.camera = {
						height: 10,
						width: 10,
						screens: 1,
					}
					break
				case 1:
					data.camera = {
						height: 9,
						width: 9,
						screens: 1,
					}
					break
				default:
					throw new Error("Invalid file!")
			}
		},
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => {
			solutionHash = view.getString(16)
		},
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => {
			data.blobMode = { 0: "1", 1: "4", 2: "256" }[view.getUint8()]
		},
	]
	let solutionHash: string
	while (view.offset < view.byteLength) {
		const sectionName = view.getString(4)
		debugger
		const length = view.getUint32()
		const oldOffset = view.offset
		switch (sectionName) {
			case "CC2M":
				if (view.getStringUntilNull() !== "7") throw new Error("Outdated file!")
				break
			case "TITL":
				// Discard (temp)
				view.getStringUntilNull()
				break
			case "AUTH":
				// Discard (temp)
				view.getStringUntilNull()
				break
			case "OPTN":
				for (let i = 0; view.offset < oldOffset + length; i++) OPTNFuncs[i]()
				break
			case "LOCK":
				// Discard
				view.getStringUntilNull()
				break
			case "KEY":
				// Discard
				view.skipBytes(16)
				break
			default:
				throw new Error("Invalid section!")
		}
		if (oldOffset + length !== view.offset) throw new Error("Invalid file!")
	}
	return data
}
