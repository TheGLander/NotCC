import AutoReadDataView from "./autoReader"
import { LevelData } from "../encoder"
import { ViewableBuffer } from "pixi.js"

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
	try {
		parseC2M(buffer)
	} catch (err) {
		alert((err as Error).message)
		throw err
	}
})

function forceIterable<T>(val: T | Iterable<T>): Iterable<T> {
	if (!val[Symbol.iterator]) return [val as T]
	else return val as Iterable<T>
}

function unpackageCompressedField(buff: ArrayBuffer): ArrayBuffer {
	const view = new AutoReadDataView(buff)
	const totalLength = view.getUint16()
	const newBuff = new ArrayBuffer(totalLength)
	const newView = new AutoReadDataView(newBuff)
	while (newView.offset < totalLength) {
		const length = view.getUint8()
		if (length < 0x80) {
			// Data block
			newView.pushUint8(...forceIterable(view.getUint8(length)))
		} else {
			// Back-reference block
			const amount = length - 0x80
			const offset = view.getUint8()
			if (offset > newView.offset) throw new Error("Invalid compressed buffer!")

			for (let copied = 0; copied < amount; ) {
				const copyAmount = Math.min(amount - copied, offset)
				// Go back ~~in time~~
				newView.skipBytes(-offset - copied)
				// Get the bytes
				const bytes = newView.getUint8(copyAmount)
				// Return
				newView.skipBytes(offset - copyAmount + copied)
				newView.pushUint8(...forceIterable(bytes))
				copied += copyAmount
			}
		}
	}
	return newBuff
}

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
		blobMode: 1,
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
			data.blobMode = { 0: 1, 1: 4, 2: 256 }[view.getUint8()]
		},
	]
	let solutionHash: string

	while (view.offset < view.byteLength) {
		const sectionName = view.getString(4)
		//debugger
		const length = view.getUint32()
		const oldOffset = view.offset
		let levelData: ArrayBuffer
		let solutionData: ArrayBuffer
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
			case "PACK":
				levelData = unpackageCompressedField(
					buff.slice(view.offset, view.offset + length)
				)
			case "MAP ":
				if (sectionName === "MAP ")
					levelData = buff.slice(view.offset, view.offset + length)
				view.skipBytes(length)
				break
			case "LOCK":
				// Discard
				view.getStringUntilNull()
				break
			case "KEY ":
				// Discard
				view.skipBytes(16)
				break
			default:
				throw new Error(`Unknown section "${sectionName}"`)
		}
		if (oldOffset + length !== view.offset) throw new Error("Invalid file!")
	}
	return data
}
