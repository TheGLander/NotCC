import AutoReadDataView from "./autoReader"
import {
	LevelData,
	PartialLevelData,
	isPartialDataFull,
	SolutionData,
} from "../encoder"
import { Field, Direction } from "../helpers"
import data, { cc2Tile } from "./c2mData"
import rfdc from "rfdc"

const clone = rfdc()

/**
 * Gets a bit from a number
 * @param number The number to use
 * @param bitPosition The position of the bit to use, starts from right
 */
function getBit(number: number, bitPosition: number): boolean {
	return (number & (1 << bitPosition)) !== 0
}

function createFieldFromArrayBuffer(
	fieldData: ArrayBuffer,
	size: [number, number]
): LevelData["field"] {
	const view = new AutoReadDataView(fieldData)
	const field: LevelData["field"] = []
	function parseTile(): cc2Tile[] {
		const tileId = view.getUint8()
		const tiles = clone(data[tileId])

		for (let i = 0; i < tiles.length; i++) {
			const tile = tiles[i]
			if (tile === null) {
				tiles.pop()
				tiles.push(...parseTile())
				continue
			}
			if (tile[1] === null) tile[1] = view.getUint8() % 4
			if (tile[2] === null) {
				// Handle special cases
				switch (tile[0]) {
					case "thinWall": {
						const options = view.getUint8()
						const additions: cc2Tile[] = []
						if (options & 0b11111)
							additions.unshift([
								"thinWall",
								0,
								["u", "r", "d", "l"]
									.filter((_val, i) => !!((2 ** i) & options))
									.join(),
							])
						// if (getBit(options, 4)) additions.unshift(["canopy"])
						tiles.splice(tiles.indexOf(tile), 1, ...additions)
						break
					}
					case "directionalBlock": {
						const options = view.getUint8()
						const directions = ["u", "r", "d", "l"]
						tile[2] = ""
						for (let j = 0; j < 4; j++)
							if (getBit(options, j)) tile[2] += directions[j]
						break
					}
					// By default custom tiles are green
					case "customFloor":
					case "customWall":
						tile[2] = "green"
						break
					// By default letter tiles have a space
					case "letterTile":
						tile[2] = " "
						break
					case "modifier8":
					case "modifier16":
					case "modifier32": {
						let options
						if (tile[0] === "modifier8") options = view.getUint8()
						else if (tile[0] === "modifier16") options = view.getUint16()
						else options = view.getUint32()

						const modTiles = parseTile()
						tiles.splice(tiles.indexOf(tile), 1)
						switch (modTiles[0]?.[0]) {
							case undefined:
							case "steelWall":
							case "toggleSwitch":
							case "transmogrifier":
							case "teleportRed":
							case "teleportBlue":
							case "buttonPurple":
							case "buttonBlack":
								if (!modTiles[0]) modTiles[0] = [null]
								modTiles[0][3] = options
								tiles.unshift(...modTiles)
								break
							case "letterTile":
								if (options >= 0x1c && options <= 0x1f)
									modTiles[0][2] = Direction[options - 0x1c]
								else if (options >= 0x20 && options <= 0x5f)
									modTiles[0][2] = String.fromCharCode(options)
								else throw new Error("Invalid letter tile!")
								tiles.unshift(...modTiles)
								break
							case "cloneMachine": {
								const directions = ["u", "r", "d", "l"]
								modTiles[0][2] = ""
								for (let j = 0; j < 4; j++)
									if (getBit(options, j)) modTiles[0][2] += directions[j]
								tiles.unshift(...modTiles)
								break
							}
							case "customFloor":
							case "customWall":
								modTiles[0][2] = ["green", "pink", "yellow", "blue"][
									options % 4
								]
								if (modTiles[0][2] === undefined)
									throw new Error("Invalid custom wall/floor!")
								tiles.unshift(...modTiles)
								break
							case "notGate": {
								if (options < 0x18) {
									modTiles[0][0] = ([
										"notGate",
										"andGate",
										"orGate",
										"xorGate",
										"latchGate",
										"nandGate",
									] as const)[(4 & ~0x3) / 0x4]
									modTiles[0][1] = 4 & 0x3
								} else if (options >= 0x40 && options < 0x44) {
									modTiles[0][0] = "latchGateMirror"
									modTiles[0][1] = options - 0x40
								} else if (options >= 0x1e && options <= 0x27) {
									modTiles[0][0] = "countGate"
									modTiles[0][2] = (options - 0x1e).toString()
								} else if (options >= 0x18 && options <= 0x1d)
									modTiles[0][0] = "combinationTile"
								else if (options >= 43) {
									modTiles[0][0] = "voodooTile"
									modTiles[0][2] = options.toString()
								} else
									throw new Error(
										"You are trying to create a wire-based voodoo tile, which is not yet supported!"
									)
								tiles.push(...modTiles)
								break
							}
							case "railroad": {
								modTiles[0][2] = ""
								const activeTrack = (options >> 8) - (options >> 12) * 0x10
								if (activeTrack >= 6)
									throw new Error(
										`Railroad's active track is invalid! Expected value to be less than 6, got ${activeTrack}`
									)
								modTiles[0][2] += activeTrack
								// Initial direction is mod 4
								modTiles[0][2] += (options >> 12) % 4
								for (let i = 0; i < 6; i++)
									if (getBit(options, i)) modTiles[0][2] += i.toString()
								if (getBit(options, 6)) modTiles[0][2] += "s"
								tiles.push(...modTiles)
								break
							}
							default:
								console.warn(
									`Found a modifier on an unrelated actor "${tiles[0]}"`
								)
								tiles.push(...modTiles)
								break
						}
						break
					}
					default:
						throw new Error(
							`(Internal) Bad c2mData.ts provided! (Tile with 2 null without special code: ${JSON.stringify(
								tile
							)})`
						)
				}
			}
		}

		return tiles
	}
	for (let x = 0; x < size[0]; x++) {
		for (let y = 0; y < size[1]; y++) {
			if (x === 0) field.push([])
			field[y][x] = parseTile()
		}
	}
	return field
}

function createSolutionFromArrayBuffer(
	solutionData: ArrayBuffer
): SolutionData {
	const solution: SolutionData = {}
	solution.steps = [[], []]
	const view = new AutoReadDataView(solutionData)

	view.skipBytes(1)

	solution.rffDirection = view.getUint8() % 4
	solution.blobModSeed = view.getUint8()

	// The delay before the first input
	// I think this is actually never used, but it's not a bad idea
	// This also exists because NotCC has a little different solution structure
	// Than CC2
	view.skipBytes(1)
	while (view.offset < view.buffer.byteLength) {
		const newInput = view.getUint8()

		const holdTime =
			solutionData.byteLength - view.offset === 0 ? Infinity : view.getUint8()
		if (holdTime === 0xff) break
		if (holdTime === 0x00) continue

		const resolvedInput =
			(newInput & 0x10) / 0x10 + // Up
			(newInput & 0x8) / 0x4 + // Right
			(newInput & 0x2) * 0x2 + // Down
			(newInput & 0x4) * 0x2 + // Left
			(newInput & 0x1) * 0x10 + // Drop item
			(newInput & 0x40) / 0x2 + // Cycle items
			(newInput & 0x20) * 0x2 // Switch playable

		solution.steps[newInput >> 7].push([resolvedInput, holdTime])
		if (newInput >> 7) solution.steps[0].push([resolvedInput, holdTime])
	}
	return solution
}

export function unpackagePackedData(buff: ArrayBuffer): ArrayBuffer {
	const view = new AutoReadDataView(buff)
	const totalLength = view.getUint16()
	const newBuff = new ArrayBuffer(totalLength)
	const newView = new AutoReadDataView(newBuff)
	while (newView.offset < totalLength && view.offset + 1 < buff.byteLength) {
		const length = view.getUint8()
		if (length < 0x80) {
			// Data block
			newView.pushUint8(...view.getUint8(length))
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
				newView.pushUint8(...bytes)
				copied += copyAmount
			}
		}
	}
	if (newView.offset < totalLength)
		console.warn(
			"Ran out of data while unpackaging data, returning the data gotten from the existing data"
		)
	return newBuff
}

export function packageData(buff: ArrayBuffer): ArrayBuffer | null {
	const view = new AutoReadDataView(buff)
	// It's easier to navigate with a raw uint8 array in some cases
	const arr = new Uint8Array(buff)
	const newBuff = new ArrayBuffer(buff.byteLength)
	const newView = new AutoReadDataView(newBuff)
	newView.pushUint16(buff.byteLength)

	const pendingData: number[] = []

	while (view.offset < view.byteLength) {
		let refOff = -1,
			refLength = -1
		for (
			let refCheckOff = Math.max(0, view.offset - 0x80);
			refCheckOff !== view.offset;
			refCheckOff++
		) {
			let refCheckLength = 0,
				targetOffset = view.offset
			// Count the amount of bytes we can reference at once
			while (
				arr[refCheckOff + refCheckLength] === arr[targetOffset] &&
				// The limit of references
				targetOffset - view.offset < 0x7f
			) {
				refCheckLength++
				targetOffset++
			}
			// If this is the best reference yet, remember it
			if (refCheckLength > refLength) {
				refLength = refCheckLength
				refOff = refCheckOff
			}
		}
		// If this data does not have a good reference, add it to the unreferenced data pile
		if (refLength <= 1) pendingData.push(view.getUint8())

		// If we are at the non-reference limit or we are about to do a reference, push all of the unreferenced data
		// (note that this doesn't influence the reference pointer since pointers reference the source array, while this is pushing to the packed array)
		if (pendingData.length >= 0x7f || (refLength > 1 && pendingData.length)) {
			newView.pushUint8(pendingData.length, ...pendingData)
			pendingData.length = 0
		}
		// Do the reference
		if (refLength > 1) {
			newView.pushUint8(refLength + 0x80, view.offset - refOff)
			view.skipBytes(refLength)
		}
		// If we cannot afford to add the pending data, bail
		if (newView.byteLength - newView.offset < pendingData.length + 1)
			return null
	}
	if (pendingData.length) newView.pushUint8(pendingData.length, ...pendingData)
	return newBuff.slice(0, newView.offset)
}

export function parseC2M(buff: ArrayBuffer, filename: string): LevelData {
	const view = new AutoReadDataView(buff)
	const data: PartialLevelData = {
		camera: {
			height: 10,
			width: 10,
			screens: 1,
		},
		timeLimit: 0,
		blobMode: 4,
		playablesRequiredToExit: "all",
		filename,
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
				case 2:
					data.camera = { width: 10, height: 10, screens: 2 }
					break
				default:
					throw new Error("Invalid camera mode!")
			}
		},
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => {
			// TODO Actually verify this hash
			view.getString(16)
		},
		() => view.skipBytes(1),
		() => view.skipBytes(1),
		() => {
			data.blobMode = ([1, 4, 256] as const)[view.getUint8()]
		},
	]
	let preventInvalidity = false
	loop: while (view.offset < view.byteLength) {
		const sectionName = view.getString(4)
		const length = view.getUint32()
		const oldOffset = view.offset
		switch (sectionName) {
			case "CC2M":
				if (view.offset === 8) preventInvalidity = true
				else throw new Error("The CC2M header must be first!")
				if (parseInt(view.getStringUntilNull()) > 7)
					throw new Error("Invalid file! (CC2M version is >7)")
				break
			case "TITL":
				data.name = view.getStringUntilNull()
				break
			case "AUTH":
				// Discard (temp)
				view.getStringUntilNull()
				break
			case "CLUE":
				data.defaultHint = view.getStringUntilNull()
				break
			case "NOTE": {
				let note = view.getStringUntilNull()
				let noteSectionMode: "NOTE" | "CLUE" | "COM" | "JETLIFE" = "NOTE"
				while (note.length > 0) {
					const nextSection = /\[(JETLIFE|CLUE|COM)\]/.exec(note)
					let noteSectionData: string
					if (nextSection) noteSectionData = note.substr(0, nextSection.index)
					else noteSectionData = note
					switch (noteSectionMode) {
						case "NOTE":
							data.note = noteSectionData
							break
						case "CLUE":
							data.hints ??= []
							data.hints.push(noteSectionData)
							break
						case "COM": // TODO C2M Inline code
							throw new Error("[COM] not supported (yet)!")
						case "JETLIFE":
							data.customData ??= {}
							if (!isNaN(parseInt(noteSectionData, 10)))
								data.customData.jetlife = noteSectionData
							break
					}
					note = note.substr(
						noteSectionData.length + (nextSection?.[0].length ?? 0)
					)
					noteSectionMode = (nextSection?.[1] ?? "NOTE") as
						| "NOTE"
						| "CLUE"
						| "COM"
						| "JETLIFE"
				}
				break
			}
			case "OPTN":
				for (let i = 0; view.offset < oldOffset + length; i++) OPTNFuncs[i]()
				break
			case "PACK":
			case "MAP ": {
				let levelData = buff.slice(view.offset, view.offset + length)
				if (sectionName === "PACK") levelData = unpackagePackedData(levelData)
				view.skipBytes(length)
				const [width, height] = new Uint8Array(levelData)
				;[data.width, data.height] = [width, height]
				data.field = createFieldFromArrayBuffer(levelData.slice(2), [
					height,
					width,
				])
				break
			}
			case "PRPL":
			case "REPL": {
				let solutionData = buff.slice(view.offset, view.offset + length)
				if (sectionName === "PRPL")
					solutionData = unpackagePackedData(solutionData)
				data.associatedSolution = createSolutionFromArrayBuffer(solutionData)
				data.associatedSolution.associatedLevel = { filename, name: data.name }
				view.skipBytes(length)
				break
			}
			case "LOCK":
				// Discard
				view.getStringUntilNull()
				break
			case "KEY ":
				// Discard
				view.skipBytes(16)
				break
			case "END ":
				break loop
			case "BMP ":
			case "CBMP": {
				let bmpData = buff.slice(view.offset, view.offset + length)
				if (sectionName === "CBMP") bmpData = unpackagePackedData(bmpData)
				view.skipBytes(length)
				break
			}
			default:
				view.skipBytes(length)
		}
		if (!preventInvalidity) throw new Error("The CC2M header must be first!")
		if (oldOffset + length !== view.offset)
			throw new Error("Offsets don't match up!")
	}
	if (!isPartialDataFull(data))
		throw new Error("This level is missing essential properties!")
	return data
}
