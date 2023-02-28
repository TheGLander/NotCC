import { join } from "path"
import { printf } from "fast-printf"

interface TokenType {
	regex: RegExp
	name: string
}

interface Token {
	type: string
	value: string
	fullValue: string
	position: number
}

export const C2G_NOTCC_VERSION = "0.2-NotCC"

export const C2GVariables = [
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

export const C2GReadonlyVariables = ["score"]

export type C2GState = Record<typeof C2GVariables[number], number>

export const C2GPseudoVariables = {
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
}

export const C2GDirectives: Record<
	string,
	// The returning value is if to ignore the rest of the line, by default false
	(this: C2GRunner, expressionValue: number) => void | boolean
> = {
	art() {
		console.warn("ART directives do nothing")
	},
	chain() {
		const filename = this.getToken()
		if (filename?.type === "string")
			this.queuedActions.push({
				type: "chain",
				value: join(this.fsPosition, filename.value),
			})
		else console.warn("The first argument of a chain must be a string!")
	},
	chdir() {
		const dirname = this.getToken()
		if (dirname?.type === "string")
			this.fsPosition = join(this.fsPosition, dirname.value)
		else console.warn("The first argument of a chdir must be a string!")
	},
	dlc() {
		console.warn("DLC directives do nothing")
	},
	do(lastExpression: number) {
		return !lastExpression
	},
	edit() {
		console.warn("There is no editor to open")
	},
	game() {
		const title = this.getToken()
		if (title?.type === "string") this.gameName = title.value
		else console.warn("The first argument of game must be a string!")
	},
	goto() {
		const label = this.getToken()
		if (label?.type !== "label") {
			console.warn("The first argument of a goto must be a label!")
			return
		}
		if (this.labels[label.value] !== undefined)
			this.currentToken = this.labels[label.value]
		return true
	},
	main() {
		console.warn("This should jump to playcc2.c2g, but NotCC doesn't have it!")
	},
	map() {
		const mapName = this.getToken()
		if (mapName?.type === "string")
			this.queuedActions.push({
				type: "map",
				value: join(this.fsPosition, mapName.value),
			})
		else console.warn("The first argument of a map must be a string!")
		return true
	},
	music() {
		const mapName = this.getToken()
		if (mapName?.type === "string")
			this.queuedActions.push({
				type: "music",
				// This is not resolved, since it
				// a. Can start with + to loop
				// b. Can not be a path but an alias to a pre-set song
				value: mapName.value,
			})
		else console.warn("The first argument of music must be a string!")
	},
	script() {
		// Strip everything before the first `script` line
		let token = this.getToken()
		while (token && token.type !== "newline") {
			token = this.getToken()
		}
		let finalString = ""
		token = this.getToken()
		if (!token || token.type === "newline") {
			// If the the first line of the `script` (the one after it) is blank, end the script prematurely
			return true
		}
		do {
			if (token.type === "newline") {
				finalString += "\n"
				continue
			}

			const string = token.value

			// It's time to figure out tbe escape values. Each escape value is one token in length.
			// All expressions have to be done beforehand and placed in temporary variables.
			const escapeValues: number[] = []
			token = this.getToken()
			while (token && token.type !== "newline") {
				escapeValues.push(this.evaluateExpression([token]))
				token = this.getToken()
			}
			finalString += printf(string, ...escapeValues)
		} while (token && token.type === "ass")
		// If this stopped by encountering a non-script token, vomit it back
		if (this.tokens[this.currentToken]) this.currentToken--
		if (finalString)
			this.queuedActions.push({
				type: "script",
				value: finalString.replace(/\w+$/, ""),
			})
		return true
	},
	wav() {
		console.warn("WAV directives do nothing")
	},
}

const tokenTypes: TokenType[] = [
	{ regex: /\n/, name: "newline" },
	// Strings are stopped by either quotes or newlines (or EOF) :clapping:
	// Also, no escapes in C2G, yay
	{ regex: /"([^"\n]*)(?:["\n]|$)/, name: "string" },
	{ regex: /(?:\/\/|;).+/, name: "comment" },
	// Labels are only terminated by whitespace
	{ regex: /#(\S+)/, name: "label" },
	// Numbers aren't terminated by whitespace, so `1level=` is legal
	{ regex: /\d+/, name: "number" },
	{
		regex: /==|>=|<=|!=|&&|\|\||[=+\-*/><|&^]/,
		name: "operator",
	},
	// (Lax) keywords are anything not starting with a number
	{ regex: /(?=\D)\w+/, name: "lax-keyword" },
]

type TokenTypePlace = [type: TokenType, lastMatch: RegExpExecArray | null]

type KeywordPosition = [keyword: string, position: number]
export function resolveC2GKeywords(name: string): KeywordPosition[] {
	const keywords = [
		...C2GVariables,
		...Object.keys(C2GPseudoVariables),
		...Object.keys(C2GDirectives),
	]

	const foundKeywords: KeywordPosition[] = []

	loop: for (let strPos = 0; strPos < name.length; strPos++) {
		for (const keyword of keywords) {
			if (name.startsWith(keyword)) {
				foundKeywords.push([keyword, strPos])
				strPos += keyword.length
				continue loop
			}
		}
	}
	return foundKeywords
}

export function tokenizeC2G(file: string): Token[] {
	const latestOccurrence: TokenTypePlace[] = tokenTypes
		.map(val => ({ name: val.name, regex: new RegExp(val.regex, "g") }))
		.map<TokenTypePlace>(val => [val, val.regex.exec(file)])
		.filter(val => val[1])
		.sort((a, b) =>
			!a[1] && !b[1] ? 0 : !a[1] ? 1 : !b[1] ? -1 : a[1].index - b[1].index
		)
	const tokens: Token[] = []
	let firstThing = latestOccurrence.shift(),
		lastThingEnd: number | null = null
	while (firstThing?.[1]) {
		if (!lastThingEnd || firstThing[1].index >= lastThingEnd) {
			lastThingEnd = firstThing[1].index + firstThing[1][0].length
			tokens.push({
				position: firstThing[1].index,
				type: firstThing[0].name,
				value: firstThing[1][1] ?? firstThing[1][0],
				fullValue: firstThing[1][0],
			})
		}

		firstThing[1] = firstThing[0].regex.exec(file)
		if (firstThing[1]) {
			let currentOffset = 0
			while (
				latestOccurrence[currentOffset]?.[1] &&
				// @ts-expect-error I am not sure how TS misses this
				firstThing[1].index > latestOccurrence[currentOffset][1].index
			)
				currentOffset++
			latestOccurrence.splice(currentOffset, 0, firstThing)
		}
		firstThing = latestOccurrence.shift()
	}
	// Resolve lax keywords
	const resolvedTokens: Token[] = []
	for (const token of tokens) {
		if (token.type !== "lax-keyword") {
			resolvedTokens.push(token)
			continue
		}
		const keywords = resolveC2GKeywords(token.value)
		for (const keyword of keywords) {
			resolvedTokens.push({
				position: keyword[1],
				type: "keyword",
				value: keyword[0],
				fullValue: keyword[0],
			})
		}
	}
	return resolvedTokens.filter(val => val.type !== "comment")
}

// Typescript stuff
const isVariable = (
	varName: string,
	runner: C2GRunner
): varName is typeof C2GVariables[number] => varName in runner.state
const isPseudoVariable = (
	varName: string
): varName is keyof typeof C2GPseudoVariables => varName in C2GPseudoVariables

export interface QueuedC2GAction {
	/**
	 * The type of the thing to do, in vanilla C2G
	 */
	type: string
	value: string
}

export class C2GRunner {
	/**
	 * All the labels which are after newlines, aka valid jump locations
	 * The number is the token offset, not the character offset
	 */
	labels: Record<string, number> = {}
	fsPosition = ""
	queuedActions: QueuedC2GAction[] = []
	state: C2GState = C2GVariables.reduce(
		(acc, val) => ((acc[val] = 0), acc),
		{} as Partial<C2GState>
	) as C2GState
	currentToken = 0
	gameName?: string
	c2gTitle: string
	constructor(public tokens: Token[] = []) {
		// If the first line doesn't contain a closed string, this is invalid
		const strPos = tokens.findIndex(
				val => val.type === "string" && val.fullValue.endsWith('"')
			),
			str = tokens[strPos],
			newlinePos = tokens.findIndex(val => val.type === "newline")
		if ((newlinePos !== -1 && strPos > newlinePos) || strPos === -1)
			throw new Error(
				"All C2Gs must contain a closed string in the first line!"
			)
		this.c2gTitle = str.value
		this.updateLabels()
	}
	getToken(): Token | undefined {
		const result = this.tokens[this.currentToken]
		if (result) this.currentToken++
		return result
	}
	/**
	 * Evaluates an expression and **eats the tokens used**
	 * @returns The result of the calculations
	 */
	evaluateExpression(tokens: Token[]): number {
		// The number is the actual value, the string is the source identifier, can be null
		const stack: [number, string?][] = []
		loop: for (let token = tokens.shift(); token; token = tokens.shift())
			switch (token.type) {
				case "number":
					stack.push([parseInt(token.value)])
					break
				case "string":
					if (token.value.length < 4) {
						console.warn(
							"Strings in expressions must be at least 4 characters!"
						)
						break
					}
					stack.push([
						[...token.value.substr(0, 4)]
							.map(val => val.charCodeAt(0))
							.reduce((acc, val, i) => acc + 0x100 ** i * val, 0),
					])
					break
				case "keyword": {
					if (isVariable(token.value, this))
						stack.push([this.state[token.value], token.value])
					else if (isPseudoVariable(token.value))
						stack.push([C2GPseudoVariables[token.value]])
					else {
						// Return the token
						tokens.unshift(token)
						break loop
					}
					break
				}
				case "operator": {
					const values = [stack.pop(), stack.pop()].reverse()
					if (!values[0] || !values[1]) {
						console.warn(
							"Not enough values on the stack to perform the operation!"
						)
						break
					}
					const a = values[0][0],
						b = values[1][0]

					let result: number | null
					switch (token.value) {
						case "+":
							result = a + b
							break
						case "-":
							result = a - b
							break
						case "*":
							result = a * b
							break
						case "/":
							result = a / b
							break
						case "&":
							result = a & b
							break
						case "|":
							result = a | b
							break
						case "^":
							result = a ^ b
							break
						case "==":
							result = a === b ? 1 : 0
							break
						case ">=":
							result = a >= b ? 1 : 0
							break
						case ">":
							result = a > b ? 1 : 0
							break
						case "<=":
							result = a <= b ? 1 : 0
							break
						case "<":
							result = a < b ? 1 : 0
							break
						case "||":
							result = a || b
							break
						case "&&":
							result = a && b
							break
						case "=":
							result = a
							if (!values[1][1] || !isVariable(values[1][1], this)) {
								console.warn(
									"You are assigning a number to anything but a number!"
								)
								break
							}
							if (C2GReadonlyVariables.includes(values[1][1])) {
								console.warn("Writing to read-only variables is not allowed!")
								break
							}
							this.state[values[1][1]] = a
							break
						default:
							console.warn(
								"This code encountered an operator partially recognized! Please file a bug report"
							)
							result = null
							break
					}
					if (result !== null) stack.push([result])
					break
				}
				// Silently drop labels
				case "label":
					break
				// Stop on newlines
				case "newline":
					break loop
				default:
					console.warn(`Found bad token type "${token.type}" in expression`)
					break
			}
		return stack[0]?.[0] ?? 0
	}
	updateLabels(): void {
		// Search for good labels
		for (const [i, token] of this.tokens.entries()) {
			if (
				token.type === "label" &&
				(!this.tokens[i - 1] || this.tokens[i - 1].type === "newline")
			)
				this.labels[token.value] = i
		}
	}
	stepLine(): number | void {
		let lastExpressionResult: number | void
		for (
			let shouldContinue = true, directiveToken = this.getToken();
			directiveToken && directiveToken.type !== "newline";
			directiveToken = this.getToken()
		) {
			// This is EOF or a newline, there is only an expression on the line

			if (shouldContinue)
				if (!C2GDirectives[directiveToken.value])
					if (
						["number", "operator", "string"].includes(directiveToken.type) ||
						isVariable(directiveToken.value, this) ||
						isPseudoVariable(directiveToken.value)
					) {
						this.currentToken--
						const tokensToProcess = this.tokens.slice(this.currentToken)
						lastExpressionResult = this.evaluateExpression(tokensToProcess)
						this.currentToken = this.tokens.length - tokensToProcess.length
					} else if (directiveToken.type === "label") {
						lastExpressionResult = undefined
						// Silently ignore labels
					} else {
						console.warn(
							"This code encountered a directive which kinda but not really exists? Please file a bug report"
						)
						break
					}
				else {
					shouldContinue = !C2GDirectives[directiveToken.value].call(
						this,
						(lastExpressionResult as number) ?? 0
					)
					lastExpressionResult = undefined
				}
		}
		return lastExpressionResult
	}
}
