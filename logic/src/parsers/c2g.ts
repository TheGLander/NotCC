import { printf } from "fast-printf"
import { win32 } from "path"
import { IScriptState } from "./nccs.pb"

export const C2G_NOTCC_VERSION = "1.0-NotCC"

// C2G identifiers which can be written and read from without much issue.
// `tleft` and `speed` are not saved in the C2S and C2H file formats, though.
export const scriptVariables = [
	"enter",
	"exit",
	"flags",
	"gender",
	"score",
	"keys",
	"level",
	"line",
	"menu",
	"reg1",
	"reg2",
	"reg3",
	"reg4",
	"result",
	"speed",
	"tleft",
	"tools",
] as const

// These keywords don't do anything, but are considerd as such when it's converted to a value
export const scriptBrokenKeywords = [
	"bonus",
	"chips",
	"no_l_doors",
	"art",
	"screen",
	"dlc",
	"wav",
	"start",
	"end",
	"main",
] as const

export const scriptDirectives = [
	"chain",
	"chdir",
	"do",
	"edit",
	"game",
	"goto",
	"map",
	"music",
	"script",
] as const

export type ScriptDirective = typeof scriptDirectives[number]

export type ScriptVariableState = Partial<
	Record<Exclude<typeof scriptVariables[number], "line" | "score">, number>
>

export type ScriptMusicState = {
	repeating: boolean
} & ({ id: string } | { path: string })

export const scriptConstants = {
	cc2h: 2,
	cc2m: 2,
	cc2s: 2,
	continue: 1,
	female: 0x56,
	ktime: 0x20,
	ktools: 0x10,
	male: 0x16,
	no_bonus: 0x40,
	get rand(): number {
		return Math.round(Math.random() * (2 ** 32 - 1) - 2 ** 31)
	},
	replay: 0x2,
	silent: 0x4,
} as const

type ScriptKeyword =
	| keyof typeof scriptConstants
	| ScriptDirective
	| typeof scriptBrokenKeywords[number]
	| typeof scriptVariables[number]

const scriptKeywords = [
	...Object.keys(scriptConstants),
	...scriptDirectives,
	...scriptBrokenKeywords,
	...scriptVariables,
] as ScriptKeyword[]

const scriptOperators = [
	"==",
	"=",
	"!=",
	"<=",
	"<",
	">=",
	">",
	"&&",
	"||",
	"+",
	"-",
	"*",
	"/",
	"%",
	"&",
	"|",
	"^",
] as const

type ScriptOperators = typeof scriptOperators[number]

interface StringToken {
	type: "string"
	value: string
	leakyValue: string
	closed: boolean
}

interface LabelToken {
	type: "label"
	value: string
	leakyValue: string
}

interface CommentToken {
	type: "comment"
	value: string
}

interface NumberToken {
	type: "number"
	value: number
}

interface OperatorToken {
	type: "operator"
	leakyValue: string
	value: ScriptOperators
}

interface KeywordToken {
	type: "keyword"
	leakyValue: string
	value: ScriptKeyword
}

type Token =
	| StringToken
	| LabelToken
	| CommentToken
	| NumberToken
	| OperatorToken
	| KeywordToken

/**
 * Joins the segments via the win32 function (which recognizes both \ and /),
 * but then converts the backslashes to the more useful normal slashes.
 */

export function joinPath(...segments: string[]): string {
	return win32.join(...segments).replace(/\\/g, "/")
}

/**
 * What should the interpreter do after this directive?
 * `"consume nothing"` pushes the directive onto the stack, as if it's a broken identifier.
 * This behaviour is mostly used for error conditions.
 *
 * `"consume token"` is the most common return type. It doesn't push the directive's token onto the stack,
 * but continues on with the line.
 *
 * `"consume line"` forces the interpreter to stop executing the current line.
 * This is used for interruptive directives, such as `chain`, `map`, and `edit`.
 */
type ActionReturnValue = "consume line" | "consume token" | "consume nothing"

// The return value is whenether to terminate the current line
const scriptDirectiveFunctions: Record<
	ScriptDirective,
	(this: ScriptRunner, line: Token[], stack: Token[]) => ActionReturnValue
> = {
	chain(line: Token[]) {
		const filename = line[0]
		if (filename?.type === "string") {
			this.scriptInterrupt = {
				type: "chain",
				path: joinPath(this.state.fsPosition ?? "", filename.value),
			}
			return "consume line"
		}
		console.warn("The first argument of a chain must be a string.")
		return "consume nothing"
	},
	chdir(line: Token[]) {
		const dirname = line[0]
		if (dirname?.type === "string") {
			this.state.fsPosition = joinPath(
				this.state.fsPosition ?? "",
				dirname.value
			)
			line.shift()
			return "consume token"
		} else {
			console.warn("The first argument of a chdir must be a string.")
			return "consume nothing"
		}
	},
	do(_line: Token[], stack: Token[]) {
		const lastToken = stack.pop()
		if (!lastToken) return "consume nothing"
		const lastValue = this.getTokenValue(lastToken)
		return lastValue === 0 ? "consume line" : "consume token"
	},
	edit() {
		console.warn("There is no editor to open.")
		return "consume line"
	},
	game(line: Token[]) {
		const titleToken = line[0]
		if (titleToken?.type === "string") {
			this.state.gameTitle = titleToken.value
			line.shift()
			return "consume token"
		} else {
			console.warn("The first argument of game must be a string.")
			return "consume nothing"
		}
	},
	goto(line: Token[]) {
		const label = line[0]
		if (label?.type !== "label") {
			console.warn("The first argument of a goto must be a label.")
			return "consume nothing"
		}
		if (this.labels[label.value] !== undefined) {
			this.state.currentLine = this.labels[label.value]
		}
		// This consumes the original line
		return "consume line"
	},
	map(line: Token[]) {
		const mapName = line[0]
		if (mapName?.type === "string") {
			this.scriptInterrupt = {
				type: "map",
				path: joinPath(this.state.fsPosition ?? "", mapName.value),
			}
			return "consume line"
		} else {
			console.warn("The first argument of a map must be a string.")
			return "consume nothing"
		}
	},
	music(line: Token[]) {
		const musicName = line[0]
		if (musicName?.type === "string") {
			this.musicChanged = true
			let str = musicName.value
			// Yeah, we're judging by if the string has an extension dot in it.
			// Vanilla music IDs don't have dots, and all music files should have an extension, so this should be fine.
			const isPath = str.includes(".")
			const isRepeating = str.startsWith("+")
			if (isRepeating) {
				str = str.slice(1)
			}
			this.state.music = isPath
				? {
						repeating: isRepeating,
						path: joinPath(this.state.fsPosition ?? "", str),
				  }
				: { repeating: isRepeating, id: str }
			return "consume token"
		} else {
			console.warn("The first argument of music must be a string!")
			return "consume nothing"
		}
	},
	script() {
		// Ignore everything past the `script` directive
		let finalString = ""

		const substitions: [number, number, number] = [0, 0, 0]
		// eslint-disable-next-line no-constant-condition
		while (true) {
			this.state.currentLine ??= 0
			this.state.currentLine += 1
			const line = this.tokenizeLine(this.state.currentLine)
			if (finalString === "" && line[0]?.type !== "string") {
				// If the first line after the `script` is empty, return prematery
				console.warn("The first line of a script must be a string.")
				break
			}
			if (line.length === 0) {
				// There aren't any tokens. C2G appends the line without the first character and with a newline at the end.
				// So, a line consisting of just a newline will still result in just a newline.
				finalString += this.scriptLines[this.state.currentLine].slice(1) + "\n"
				continue
			}

			const stringToken = line[0]
			if (stringToken.type !== "string") break

			for (let substituionI = 0; substituionI < 3; substituionI++) {
				const substitutionToken = line[substituionI + 1]
				if (!substitutionToken) break
				substitions[substituionI] = this.getTokenValue(substitutionToken)
			}
			finalString += printf(stringToken.value, ...substitions) + "\n"
		}
		this.scriptInterrupt = { type: "script", text: finalString }
		// We stopped reading on a line which doesn't work, so let the interpreter read the next line normally
		this.state.currentLine -= 1
		return "consume line"
	},
}

function makeSimpleOperator(
	func: (a: number, b: number) => number
): (this: ScriptRunner, stack: Token[]) => ActionReturnValue {
	return function (stack: Token[]) {
		// Where there are less than 2 tokens, the operator itself is treated as a value
		if (stack.length < 2) return "consume nothing"
		const b = this.getTokenValue(stack.pop() as Token)
		const a = this.getTokenValue(stack.pop() as Token)
		stack.push({ type: "number", value: Math.imul(func(a, b), 1) })
		return "consume token"
	}
}

const scriptOperatorFunctions: Record<
	ScriptOperators,
	(this: ScriptRunner, stack: Token[]) => ActionReturnValue
> = {
	"==": makeSimpleOperator((a, b) => (a === b ? 1 : 0)),
	"="(this: ScriptRunner, stack: Token[]) {
		if (stack.length < 2) return "consume nothing"
		const assignedValue = stack.pop() as Token
		const variable = stack.pop() as Token
		// Assignment to non-variables doesn't seem to do anything in CC2
		if (variable.type === "keyword" && isVariable(variable.value)) {
			const variableName = variable.value
			const variableValue = this.getTokenValue(assignedValue)
			if (variableName === "line") {
				this.state.currentLine = variableValue
			} else if (variableName === "score") {
				// This variable is readonly, meaning the game can set it after `map`s, but the script can't alter it itself
			} else {
				// Whoo regular assignment
				if (!this.state.variables) {
					this.state.variables = {}
				}
				this.state.variables[variableName] = variableValue
			}
		}
		stack.push(assignedValue)
		return "consume token"
	},
	"!=": makeSimpleOperator((a, b) => (a !== b ? 1 : 0)),
	"<=": makeSimpleOperator((a, b) => (a <= b ? 1 : 0)),
	"<": makeSimpleOperator((a, b) => (a < b ? 1 : 0)),
	">=": makeSimpleOperator((a, b) => (a >= b ? 1 : 0)),
	">": makeSimpleOperator((a, b) => (a > b ? 1 : 0)),
	"&&": makeSimpleOperator((a, b) => (a && b ? 1 : 0)),
	"||": makeSimpleOperator((a, b) => (a || b ? 1 : 0)),
	"+": makeSimpleOperator((a, b) => a + b),
	"-": makeSimpleOperator((a, b) => a - b),
	"*": makeSimpleOperator((a, b) => a * b),
	"/": makeSimpleOperator((a, b) => a / b),
	"%": makeSimpleOperator((a, b) => a % b),
	"&": makeSimpleOperator((a, b) => a & b),
	"|": makeSimpleOperator((a, b) => a | b),
	"^": makeSimpleOperator((a, b) => a ^ b),
}

// Typescript stuff
const isVariable = (
	varName: string
): varName is typeof scriptVariables[number] =>
	scriptVariables.includes(varName as keyof ScriptVariableState)
const isConstant = (varName: string): varName is keyof typeof scriptConstants =>
	varName in scriptConstants
const isDirective = (varName: string): varName is ScriptDirective =>
	(scriptDirectives as readonly string[]).includes(varName)

export type ScriptInterrupt =
	| {
			type: "chain" | "map"
			path: string
	  }
	| { type: "script"; text: string }

export interface ScriptMusic {
	path: string
	repeating: boolean
}

export const scriptLegalInventoryTools = [
	null,
	"bootForceFloor",
	"bootIce",
	"bootFire",
	"bootWater",
	"tnt",
	"helmet",
	"bootDirt",
	"lightningBolt",
	"bowlingBall",
	"teleportYellow",
	"railroadSign",
	"foil",
	"secretEye",
	"bribe",
	"bootSpeed",
	"hook",
] as const

export type ScriptLegalInventoryTool = typeof scriptLegalInventoryTools[number]

export type MapInterruptResponse =
	| {
			type: "win"
			totalScore: number
			lastExitGender: "male" | "female"
			lastExitN: number
			inventoryTools: ScriptLegalInventoryTool[]
			inventoryKeys: Record<"red" | "green" | "blue" | "yellow", number>
			timeLeft: number
	  }
	| { type: "retry" }
	| { type: "skip" }

function stringToValue(str: string): number {
	return str
		.slice(0, 4)
		.split("")
		.map(char => char.charCodeAt(0))
		.reduce((acc, val, i) => (acc + val) << (8 * i), 0)
}

export const MAX_LINES_UNTIL_TERMINATION = 1_000_000_000

export class ScriptRunner {
	labels: Record<string, number> = {}
	// The current filesystem position, changed by `chdir`.
	scriptInterrupt: ScriptInterrupt | null = null
	totalScore = 0
	state: IScriptState = {}

	// Indicates if the UI should start playing the music track from the beginning.
	// This is important in scenarios like
	// ```
	// music "+Despacito"
	// map "coolMap.c2m"
	// ```
	// and
	// ```
	// music "+Despacito" map "coolMap.c2m"
	// ```
	// The former has the music track on loop, even if the map is restarted.
	// The latter has the music start from the beginning on each level restart.
	musicChanged = false
	scriptLines: string[]
	constructor(script: string, scriptPath?: string, state?: IScriptState) {
		if (state) {
			this.state = state
		}
		this.loadScript(script, scriptPath, !state)
		//@ts-expect-error Hack to silence TypeScript, since it *can't believe* `this.scriptLines` is assigned in `this.loadScript`
		this.scriptLines = this.scriptLines as string[]
	}
	loadScript(script: string, scriptPath?: string, requireTitle = false): void {
		this.scriptLines = script.split(/\n\r?/g)
		if (requireTitle) {
			const scriptTitleToken = this.tokenizeLine(0).find(
				(token): token is StringToken => token.type === "string"
			)
			if (!scriptTitleToken || !scriptTitleToken.closed)
				throw new Error(
					"The first line of the script must contain a closed string describing the title."
				)
			this.state.scriptTitle = scriptTitleToken.value
		}
		if (scriptPath !== undefined) {
			this.state.scriptPath = scriptPath
		}
		this.generateLabels()
	}
	generateLabels(): void {
		for (let lineN = 0; lineN < this.scriptLines.length; lineN++) {
			const tokens = this.tokenizeLine(lineN)
			const labelToken = tokens[0]
			if (labelToken?.type !== "label") continue
			// The first label in the script is the canonical one
			if (this.labels[labelToken.value]) continue
			this.labels[labelToken.value] = lineN
		}
	}
	tokenizeLine(lineN: number): Token[] {
		const line = this.scriptLines[lineN]
		const tokens: Token[] = []
		let linePos = 0
		while (line[linePos] !== undefined) {
			// Strings
			if (line[linePos] === '"') {
				let stringValue = ""
				linePos++
				const leakyValue = line.slice(linePos, linePos + 4)
				// Lines are not only terminated by closing "'s, but also by newlines.
				while (line[linePos] !== '"' && line[linePos] !== undefined) {
					stringValue += line[linePos]
					linePos++
				}
				tokens.push({
					type: "string",
					closed: line[linePos] === '"',
					value: stringValue,
					leakyValue,
				})
				// Consume the closing "
				if (line[linePos] === '"') linePos++
				continue
			}
			// Comments
			if (line[linePos] === ";") {
				tokens.push({ type: "comment", value: line.slice(linePos + 1) })
				break
			}
			// Labels
			if (line[linePos] === "#") {
				let labelValue = ""
				linePos++
				const leakyValue = line.slice(linePos, linePos + 4)
				while (line[linePos] !== undefined && line[linePos] !== " ") {
					labelValue += line[linePos]
					linePos++
				}
				tokens.push({ type: "label", value: labelValue, leakyValue })
				continue
			}
			// Integer
			if (!isNaN(parseInt(line[linePos], 10))) {
				// Vanilla `parseInt` works in this case
				const intValue = parseInt(line.slice(linePos), 10)
				tokens.push({ type: "number", value: intValue })
				linePos += intValue.toString().length
				continue
			}
			// Operator
			{
				const operator = scriptOperators.find(val =>
					line.slice(linePos).startsWith(val)
				)
				if (operator !== undefined) {
					const leakyValue = line.slice(linePos, linePos + 4)
					tokens.push({ type: "operator", value: operator, leakyValue })
					linePos += operator.length
					continue
				}
			}
			// Keyword
			{
				const keyword = scriptKeywords.find(val =>
					line.slice(linePos).toLowerCase().startsWith(val)
				)
				if (keyword !== undefined) {
					const leakyValue = line.slice(linePos, linePos + 4)
					tokens.push({ type: "keyword", value: keyword, leakyValue })
					linePos += keyword.length
					continue
				}
			}
			// Nothing matched, just move on.
			linePos++
		}
		return tokens
	}
	getTokenValue(token: Token): number {
		// Comments have explicitly the integer value 0. This is demonstrated by the following code:
		// ```
		// script
		// "Setting %d %d %d" 1 2 3
		// "Reading %d %d %d" ; hi
		// ```
		// In CC2, this will show the text "Setting 1 2 3", "Reading 0 2 3"
		// Note that `script` substitution variables are keps across lines, so the 2 and 3 are persisted,
		// while the comment overwrites the first substitution variable to be 0 instead of 1.
		if (token.type === "comment") return 0
		if (token.type === "number") return token.value
		if (token.type === "keyword") {
			if (isVariable(token.value)) {
				if (token.value === "line") return this.state.currentLine ?? 0
				if (token.value === "score") return this.totalScore
				return this.state.variables?.[token.value] ?? 0
			}
			if (isConstant(token.value)) {
				return scriptConstants[token.value]
			}
		}
		// If we have a token here, it has to be either a broken identifier or a directive which didn't execute correctly.
		// If we have an operator here, the operator didn't have enough arguments and is treated as a value itself.
		// This could also be a label or a string.
		// This are tokens which don't special handling for finding it's value, as it's not supposed to happen.
		// They are treated as strings (with a maximum of 4 characters) starting from the first character of the token, as it appears in the source code.
		// This is an important distinction from the normal token value. For example, the lines
		// `mApreg1=` has "mApr" set to `reg1`, while
		// `Map reg1 =` will have "Map " in `reg1`.
		// Labels and strings are slightly different, where their source code string value starts after the prefix " or #, without including it in the value
		// So, `#abc reg1 =` will result in `reg1` having the value "abc ",
		// and `"p" reg1 =` will set `reg1` to the string 'p" r'.
		// The tokenizing function above correctly removes the # and " from the leakyValue property.
		// Note: CC2 doesn't have consistent values after the end of the line and the terminating null, which can be observed with
		// ```
		// script
		// "%d" do
		// ```
		// - the string (decoded from the number) will start with "do\0" (where \0 is a singular null character),
		// but the fourth one isn't guaranteed to be anything in particular
		// In this implementation, all characters after the end of the line are reported as null characters.
		return stringToValue(token.leakyValue)
	}
	executeTokens(tokens: Token[], allowDirectives = true): void {
		const stack: Token[] = []
		// We don't use iteration here, since we actually
		// need a half-destroyed array for directives to read the first token
		// *past* itself, and to mutate the line to remove the first token past itself
		for (
			let token = tokens.shift() as Token;
			(token = tokens.shift() as Token);
			tokens.length > 0
		) {
			// This loop mainly handles operators and directives,
			// so if it's not that, just push the token onto the stack and move on
			if (
				!(
					(token.type === "keyword" && isDirective(token.value)) ||
					token.type === "operator"
				)
			) {
				stack.push(token)
				continue
			}
			let returnVal: ActionReturnValue
			if (token.type === "operator") {
				returnVal = scriptOperatorFunctions[token.value].call(this, stack)
			} else {
				if (allowDirectives) {
					returnVal = scriptDirectiveFunctions[
						token.value as ScriptDirective
					].call(this, tokens, stack)
				} else {
					// Yeah, if we're not allowed to run directives, tream them like normal tokens
					returnVal = "consume nothing"
				}
			}
			if (returnVal === "consume line") break
			if (returnVal === "consume nothing") {
				// Put the directive/operator token (with it's leaky value) onto the stack
				stack.push(token)
			}
		}
	}
	executeLine(): void {
		if (this.scriptInterrupt)
			throw new Error(
				"The current interrupt must be handled before executing further lines."
			)
		this.state.currentLine ??= 0
		if (this.state.currentLine >= this.scriptLines.length)
			throw new Error("The end of the script has already been reached.")

		const line = this.tokenizeLine(this.state.currentLine)
		this.executeTokens(line, true)

		this.state.currentLine += 1
	}
	executeUntilInterrupt(): ScriptInterrupt | null {
		let linesExecuted = 0
		this.state.currentLine ??= 0

		do {
			linesExecuted += 1
			if (linesExecuted > MAX_LINES_UNTIL_TERMINATION)
				throw new Error(
					"The script ran for too long, perhaps stuck in an infinite loop?"
				)
			this.executeLine()
		} while (
			this.state.currentLine < this.scriptLines.length &&
			!this.scriptInterrupt
		)
		return this.scriptInterrupt
	}
	handleMapInterrupt(interruptData: MapInterruptResponse): void {
		if (this.scriptInterrupt?.type !== "map")
			throw new Error(
				"This method can only be called to handle `map` interrupts."
			)
		this.state.currentLine ??= 0
		this.scriptInterrupt = null
		if (interruptData.type === "retry") {
			// Replay the current line
			this.state.currentLine -= 1
			return
		}
		if (interruptData.type === "skip") {
			// Set the win-related variables to 0 and continue
			if (!this.state.variables) {
				// If all variables are 0, don't do anything, since we're already all set
				return
			}
			this.state.variables.exit = 0
			this.state.variables.tools = 0
			this.state.variables.keys = 0
			this.state.variables.gender = 0
			this.state.variables.tleft = 0
			return
		}
		if (!this.state.variables) {
			this.state.variables = {}
		}
		const keys = interruptData.inventoryKeys
		this.state.variables.keys =
			keys.red +
			keys.blue * 0x100 +
			keys.yellow * 0x10000 +
			keys.green * 0x1000000

		const tools = interruptData.inventoryTools
		function getToolId(id: ScriptLegalInventoryTool): number {
			return scriptLegalInventoryTools.indexOf(id)
		}
		this.state.variables.tools =
			getToolId(tools[0]) +
			getToolId(tools[1]) * 0x100 +
			getToolId(tools[2]) * 0x10000 +
			getToolId(tools[3]) * 0x1000000
		this.state.variables.gender = scriptConstants[interruptData.lastExitGender]
		this.state.variables.exit = interruptData.lastExitN
		this.state.variables.tleft = Math.imul(interruptData.timeLeft / 60, 1)
		this.totalScore = interruptData.totalScore
	}
	handleChainInterrupt(fileData: string): void {
		if (this.scriptInterrupt?.type !== "chain")
			throw new Error(
				"This method can only be called to handle `chain` interrupts."
			)

		this.loadScript(fileData, this.scriptInterrupt.path)
		this.scriptInterrupt = null
	}
}
