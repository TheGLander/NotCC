import AutoReadDataView from "./autoReader"
import { unpackagePackedData } from "./c2m"
import { SolutionData } from "../encoder"

export function parseAndApply100byteSave(
	buffer: ArrayBuffer,
	solution: SolutionData
): void {
	const arr = new Int32Array(buffer)
	solution.c2gState = {
		line: arr[0],
		level: arr[6],
		gender: arr[9],
		enter: arr[10],
		exit: arr[11],
		result: arr[13],
		reg1: arr[14],
		reg2: arr[15],
		reg3: arr[16],
		reg4: arr[17],
		menu: arr[18],
		flags: arr[19],
		tools: arr[20],
		keys: arr[21],
		speed: 1,
		tleft: 0,
	}
	solution.expectedOutcome = {
		bonusScore: arr[2],
		timeLeft: arr[3],
		totalScore: arr[23],
	}
	/* Data which is kinda useless:
arr[1] - Total score for all levels in set
arr[4] - Chips left in level
arr[7] - Initial time
arr[8] - Amount of tries before win
arr[12] - If the level was completed, 1, otherwise 0, is a int32 :clapping:
arr[22] - The same as ceil(arr[3] / 60), in this case
arr[24] - Some kinda undocumented checksum
*/
}

function setSolutionSteps(
	solutionData: ArrayBuffer,
	solution: SolutionData
): void {
	const view = new AutoReadDataView(solutionData)

	const playerN = view.getUint8()

	while (view.offset < solutionData.byteLength) {
		const newInput = view.getUint8()
		const holdTime = view.getUint8()

		if (holdTime === 0x00) continue

		solution.steps[playerN].push([
			newInput,
			holdTime === 0xff ? Infinity : holdTime,
		])

		if (holdTime === 0xff) break
	}
}

function parseSTATSection(buff: ArrayBuffer, solution: SolutionData): void {
	const view = new AutoReadDataView(buff)
	while (view.offset < buff.byteLength) {
		const stateType = view.getUint8()
		const stateLength = view.getUint8()
		switch (stateType) {
			case 0x01:
				solution.rffDirection = view.getUint8()
				break
			case 0x02:
				solution.blobModSeed = view.getUint8()
				break
			// TODO D&R actors and such
			default:
				view.skipBytes(stateLength)
				break
		}
	}
}

export function parseNCCS(buffer: ArrayBuffer): SolutionData[] {
	const view = new AutoReadDataView(buffer)
	const solutions: SolutionData[] = []
	let solution: SolutionData = { steps: [] }
	solution.associatedLevel = {}
	let setName: string | undefined,
		filename: string | undefined,
		password: string | undefined,
		levelName: string | undefined
	loop: while (view.offset < buffer.byteLength) {
		const sectionName = view.getString(4)
		const length = view.getUint32()
		const oldOffset = view.offset
		switch (sectionName) {
			case "NCCS":
				const fullVersion = view.getStringUntilNull()
				const [major] = fullVersion.split(".")
				if (parseInt(major) > 0)
					throw new Error("Solution major version is too new!")
				break
			case "FILE":
				solution.associatedLevel.filename = filename =
					view.getStringUntilNull() || undefined
				break
			case "TYPE":
				solution.associatedLevel.setName = setName =
					view.getStringUntilNull() || undefined
				break
			case "NAME":
				solution.associatedLevel.name = levelName =
					view.getStringUntilNull() || undefined
				break
			case "PASS":
				solution.associatedLevel.password = password =
					view.getStringUntilNull() || undefined
				break
			case "SLN":
			case "PSLN": {
				let solutionData = buffer.slice(view.offset, view.offset + length)
				if (sectionName === "PSLN")
					solutionData = unpackagePackedData(solutionData)
				setSolutionSteps(solutionData, solution)
				view.skipBytes(length)
			}
			case "STAT": {
				const stateData = buffer.slice(view.offset, view.offset + length)
				parseSTATSection(stateData, solution)
				view.skipBytes(length)
				break
			}
			case "MISC":
				parseAndApply100byteSave(
					buffer.slice(view.offset, view.offset + 100),
					solution
				)
				view.skipBytes(100)
				break
			case "NEXT":
				solutions.push(solution)
				solution = { steps: [] }
				solution.associatedLevel = {
					filename,
					setName,
					name: levelName,
					password,
				}
				break
			case "END":
				break loop
			default:
				view.skipBytes(length)
				break
		}
		if (oldOffset + length !== view.offset) throw new Error("Invalid offset!")
	}
	solutions.push(solution)
	return solutions
}
