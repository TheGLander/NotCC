import AutoReadDataView from "./autoReader"
import { LevelData } from "../encoder"
import { Field, Direction } from "../helpers"
import data, { cc2Tile } from "./c2mData"
import clone from "deepclone"

document.addEventListener("dragover", e => {
	e.stopPropagation()
	e.preventDefault()
	if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
})

// Get file data on drop
document.addEventListener("drop", async e => {
	e.stopPropagation()
	e.preventDefault()
	const file = e.dataTransfer?.items[0]
	if (!file) return
	const buffer = await file?.getAsFile()?.arrayBuffer()
	if (!buffer) return
	console.log(parseC2M(buffer))
})

/**
 * Checks if the value is an iterable, if not, creates an array out of it
 * @param val
 */
function forceIterable<T>(val: T | Iterable<T>): Iterable<T> {
	// @ts-expect-error Ts doesn't understand iterables
	if (!val[Symbol.iterator]) return [val as T]
	else return val as Iterable<T>
}

/**
 * Gets a bit from a number
 * @param number The number to use
 * @param bitPosition The position of the bit to use, starts from right
 */
function getBit(number: number, bitPosition: number): boolean {
	return (number & (1 << bitPosition)) !== 0
}

function convertBitField(
	bitField: ArrayBuffer,
	size: [number, number]
): Field<[string, Direction, string?][]> {
	const view = new AutoReadDataView(bitField)
	const field: Field<[string, Direction, string?][]> = []
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
			if (tile[1] === null) tile[1] = view.getUint8()
			if (tile[2] === null) {
				// Handle special cases
				switch (tile[0]) {
					case "thinWall": {
						const options = view.getUint8()
						const additions: cc2Tile[] = []
						for (let j = 0; j < 4; j++)
							if (getBit(options, j)) additions.unshift(["thinWall", j])
						if (getBit(options, 4)) additions.unshift(["canopy", 0])
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
					case "modifier8": {
						const options = view.getUint8()
						const modTiles = parseTile()
						tiles.splice(tiles.indexOf(tile), 1)
						switch (modTiles[0][0]) {
							case "floor":
							case "steelWall":
							case "toggleSwitch":
							case "transmogrifier":
							case "teleportRed":
							case "teleportBlue":
							case "buttonPurple":
							case "buttonBlack":
								tiles.unshift(...modTiles)
								for (let j = 0; j < 4; j++)
									if (getBit(options, j)) tiles.unshift(["wire", j])
								for (let j = 4; j < 8; j++)
									if (getBit(options, j)) tiles.unshift(["wireTunnel", j])
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
								tile[2] = ["green", "pink", "yellow", "blue"][view.getUint8()]
								if (tile[2] === undefined)
									throw new Error("Invalid custom wall/floor!")
								tiles.unshift(...modTiles)
								break
							case "notGate": {
								if (
									options >= 0x44 ||
									(options >= 0x18 && options <= 0x1d) ||
									(options >= 0x27 && options <= 0x3f)
								)
									throw new Error("Voodoo tiles not supported(for now)")
								let keyOptions = options
								const curTile = modTiles[0]
								loop: while (keyOptions < 0x44) {
									switch (keyOptions) {
										case 0x3:
											// Subtract [offset from 0] to get direction, 0 in this case
											curTile[1] = options - 0x0
											break loop
										case 0x7:
											curTile[0] = "andGate"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0x4
											break loop
										case 0xb:
											curTile[0] = "orGate"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0x8
											break loop
										case 0xf:
											curTile[0] = "xorGate"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0xc
											break loop
										case 0x13:
											curTile[0] = "latchGate"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0x10
											break loop
										case 0x17:
											curTile[0] = "nandGate"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0x14
											break loop
										case 0x27:
											curTile[0] = "countGate"
											// Subtract [offset from 0] to get direction
											curTile[2] = (options - 0x1e).toString(10)
											break loop
										case 0x43:
											curTile[0] = "latchGateMirror"
											// Subtract [offset from 0] to get direction
											curTile[1] = options - 0x40
											break loop
										default:
											keyOptions++
											break
									}
								}
								tiles.push(...modTiles)
								break
							}
							default:
								throw new Error("Invalid 8-bit modifier!")
						}
						break
					}
					default:
						throw new Error(
							`(Internal) Bad c2m data provided! (Tile with 2 null: ${JSON.stringify(
								tile
							)})`
						)
				}
			}
		}

		return tiles
	}
	for (let x = 0; x < size[0]; x++) {
		field.push([])
		for (let y = 0; y < size[1]; y++) {
			field[x][y] = parseTile()
		}
	}
	return field
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
	const data: Partial<LevelData> = {
		camera: {
			height: 10,
			width: 10,
			screens: 1,
		},
		extUsed: ["cc", "cc2"],
		timeLimit: 0,
		blobMode: 1,
	}

	let solutionHash: string

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
			data.blobMode = [1, 4, 256][view.getUint8()]
		},
	]

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
				data.name = view.getStringUntilNull()
				break
			case "AUTH":
				// Discard (temp)
				view.getStringUntilNull()
				break
			case "CLUE":
				// Discard (temp)
				view.getStringUntilNull()
				break
			case "NOTE":
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
			// eslint-disable-next-line no-fallthrough
			case "MAP ": {
				if (sectionName === "MAP ")
					levelData = buff.slice(view.offset, view.offset + length)
				view.skipBytes(length)
				// @ts-expect-error This case will be either from PACK or MAP, in both cases it will be set
				// eslint-disable-next-line no-case-declarations, no-self-assign
				levelData = levelData
				const [width, height] = new Uint8Array(levelData)
				data.field = convertBitField(levelData.slice(2), [height, width])
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
			default:
				view.skipBytes(length)
		}
		if (oldOffset + length !== view.offset) throw new Error("Invalid file!")
	}
	// TODO Check that all properties are in place
	return data as LevelData
}
