import AutoReadDataView from "./autoReader"
import { packageData, unpackagePackedData } from "./c2m"
import { SolutionData, SolutionDataWithSteps, SolutionStep } from "../encoder"

const LATEST_NCCS_VERSION = "0.2"

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
		bonusScore: arr[2] === -1 ? undefined : arr[2],
		timeLeft: arr[3] === -1 ? undefined : arr[3],
		totalScore: arr[23] === -1 ? undefined : arr[23],
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

export function write100byteSaveFromSolution(
	solution: SolutionData
): ArrayBuffer {
	const buff = new ArrayBuffer(100)
	const arr = new Int32Array(buff)
	if (solution.c2gState) {
		arr[0] = solution.c2gState.line
		arr[6] = solution.c2gState.level
		arr[9] = solution.c2gState.gender
		arr[10] = solution.c2gState.enter
		arr[11] = solution.c2gState.exit
		arr[13] = solution.c2gState.result
		arr[14] = solution.c2gState.reg1
		arr[15] = solution.c2gState.reg2
		arr[16] = solution.c2gState.reg3
		arr[17] = solution.c2gState.reg4
		arr[18] = solution.c2gState.menu
		arr[19] = solution.c2gState.flags
		arr[20] = solution.c2gState.tools
		arr[21] = solution.c2gState.keys
		// tleft and speed are not saved
	}
	if (solution.expectedOutcome) {
		arr[2] = solution.expectedOutcome.bonusScore ?? -1
		arr[3] = solution.expectedOutcome.timeLeft ?? -1
		arr[23] = solution.expectedOutcome.totalScore ?? -1
	} else arr[2] = arr[3] = arr[23] = -1
	return buff
}

function setSolutionSteps(
	solutionData: ArrayBuffer,
	solution: SolutionData
): void {
	const view = new AutoReadDataView(solutionData)

	const playerN = view.getUint8()

	solution.steps ??= []
	solution.steps[playerN] ??= []
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

function fixSolutionSteps(steps: SolutionStep[]): SolutionStep[] {
	return steps.reduce<SolutionStep[]>((acc, val) => {
		if (val[1] <= 0xfc) return [...acc, val]
		const steps: SolutionStep[] = []
		while (val[1] > 0xfc) {
			steps.push([val[0], 0xfc])
			val[1] -= 0xfc
		}
		steps.push(val)
		return [...acc, ...steps]
	}, [])
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
	let solution: SolutionData = {}
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
			case "NCCS": {
				const fullVersion = view.getStringUntilNull()
				const [major] = fullVersion.split(".")
				const [currentMajor] = LATEST_NCCS_VERSION.split(".")
				if (parseInt(major) > parseInt(currentMajor))
					throw new Error("Solution major version is too new!")
				break
			}
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
			case "SLN ":
			case "PSLN": {
				let solutionData = buffer.slice(view.offset, view.offset + length)
				if (sectionName === "PSLN")
					solutionData = unpackagePackedData(solutionData)
				setSolutionSteps(solutionData, solution as SolutionData)
				view.skipBytes(length)
				break
			}
			case "STAT": {
				const stateData = buffer.slice(view.offset, view.offset + length)
				parseSTATSection(stateData, solution as SolutionData)
				view.skipBytes(length)
				break
			}
			case "MISC":
			case "PMSC": {
				let miscData = buffer.slice(view.offset, view.offset + length)
				if (sectionName === "PMSC") miscData = unpackagePackedData(miscData)
				parseAndApply100byteSave(miscData, solution)
				view.skipBytes(length)
				break
			}
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
			case "END ":
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

export function writeNCCS(solutions: SolutionData[]): ArrayBuffer {
	const solutionSectionsArray: ArrayBuffer[] = []
	function writeSection(sectionName: string, data: ArrayBuffer): void {
		const newData = new ArrayBuffer(data.byteLength + 8)

		new Uint8Array(newData).set(
			Uint8Array.from(sectionName, str => str.charCodeAt(0))
		)
		new DataView(newData).setUint32(4, data.byteLength, true)
		new Uint8Array(newData).set(new Uint8Array(data), 8)
		solutionSectionsArray.push(newData)
	}
	function writeStringSection(sectionName: string, sectionValue: string): void {
		writeSection(
			sectionName,
			Uint8Array.from([
				...Array.from(sectionValue, str => str.charCodeAt(0)),
				0,
			]).buffer
		)
	}
	writeStringSection("NCCS", LATEST_NCCS_VERSION)
	// Sort the solutions in this very careful way so records with the same sticky data are together
	solutions = [...solutions].sort((solA, solB) => {
		if (!solA.associatedLevel && !solB.associatedLevel) return 0
		if (!solA.associatedLevel) return -1
		if (!solB.associatedLevel) return 1
		const a = solA.associatedLevel,
			b = solB.associatedLevel
		for (const prop of ["password", "name", "filename", "setName"] as const)
			if (a[prop] && b[prop])
				return (a[prop] as string).localeCompare(b[prop] as string)
		return 0
	})
	let setName: string | undefined,
		filename: string | undefined,
		password: string | undefined,
		levelName: string | undefined
	for (const solution of solutions) {
		// Write sticky metadata
		if (solution.associatedLevel?.password !== password) {
			password = solution.associatedLevel?.password
			writeStringSection("PASS", password || "")
		}
		if (solution.associatedLevel?.filename !== filename) {
			filename = solution.associatedLevel?.filename
			writeStringSection("FILE", filename || "")
		}
		if (solution.associatedLevel?.name !== levelName) {
			levelName = solution.associatedLevel?.name
			writeStringSection("NAME", levelName || "")
		}
		if (solution.associatedLevel?.setName !== setName) {
			setName = solution.associatedLevel?.setName
			writeStringSection("TYPE", setName || "")
		}
		const miscData = write100byteSaveFromSolution(solution)
		const packedMiscData = packageData(miscData)
		if (packedMiscData) writeSection("PMSC", packedMiscData)
		else writeSection("MISC", miscData)

		if (solution.steps)
			for (const [i, stepSet] of solution.steps.entries()) {
				if (stepSet.length === 0) continue
				const buff = Uint8Array.from(
					[[i], ...fixSolutionSteps(stepSet)].reduce(
						(acc, val) => [...acc, ...val],
						[]
					)
				).buffer
				const packedBuff = packageData(buff)
				if (packedBuff) writeSection("PSLN", packedBuff)
				else writeSection("SLN ", buff)
			}
		if (solution.blobModSeed || solution.rffDirection) {
			const data: number[] = []
			if (solution.rffDirection) data.push(0x01, 1, solution.rffDirection)
			if (solution.blobModSeed) data.push(0x02, 1, solution.blobModSeed)
			writeSection("STAT", Uint8Array.from(data).buffer)
		}
		writeSection("NEXT", new ArrayBuffer(0))
	}
	// Remove the last "NEXT" section
	if (solutions.length > 0) solutionSectionsArray.pop()
	writeSection("END ", new ArrayBuffer(0))
	const buff = new ArrayBuffer(
		solutionSectionsArray.reduce((acc, val) => acc + val.byteLength, 0)
	)
	const arr = new Uint8Array(buff)
	let offset = 0
	for (const section of solutionSectionsArray) {
		arr.set(new Uint8Array(section), offset)
		offset += section.byteLength
	}
	return buff
}
