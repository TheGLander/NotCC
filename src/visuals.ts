import { Direction } from "./helpers"
import { LevelState } from "./level"
import ogData from "./cc2ImageFormat"
import { SizedWebGLTexture, WebGLRenderer } from "./rendering"

type CC2Animation = [number, number] | [[number, number], [number, number]]

type CC2AnimationCollection = Record<string, CC2Animation>

export interface CC2ImageFormat {
	actorMapping: Record<string, CC2Animation | CC2AnimationCollection>
}

export interface InflatedCC2ImageFormat {
	actorMapping: Record<string, Record<string, [number, number][]>>
}

const renderer = new WebGLRenderer()

function canvasToBlobURI(canvas: HTMLCanvasElement) {
	return new Promise<string>(res =>
		canvas.toBlob(blob => res(URL.createObjectURL(blob)))
	)
}

async function removeBackground(
	link: string,
	bgColor: number
): Promise<string> {
	const img = await new Promise<HTMLImageElement>((res, rej) => {
		const img = new Image()
		img.addEventListener("load", () => res(img))
		img.addEventListener("error", err => rej(err.error))
		img.src = link
	})
	const ctx = document.createElement("canvas").getContext("2d")
	if (!ctx) throw new Error("When does this even happen, anyways?")
	;[ctx.canvas.width, ctx.canvas.height] = [img.width, img.height]
	ctx.drawImage(img, 0, 0)
	const rawData = ctx.getImageData(0, 0, img.width, img.height)
	for (let i = 0; i < rawData.data.length; i += 4) {
		if (
			rawData.data[i] * 0x010000 +
				rawData.data[i + 1] * 0x000100 +
				rawData.data[i + 2] * 0x000001 ===
			bgColor
		)
			rawData.data[i + 3] = 0
	}
	ctx.putImageData(rawData, 0, 0)
	return canvasToBlobURI(ctx.canvas)
}

const data: InflatedCC2ImageFormat = { actorMapping: {} }

// Convert the shortcutted image data to the full, bloat-ish version
for (const actorAnimsName in ogData.actorMapping) {
	data.actorMapping[actorAnimsName] = {}
	let actorAnims = ogData.actorMapping[actorAnimsName]
	if (actorAnims instanceof Array) actorAnims = { default: actorAnims }
	for (const actorAnimName in actorAnims) {
		const actorAnim = actorAnims[actorAnimName]
		if (actorAnim[0] instanceof Array) {
			data.actorMapping[actorAnimsName][actorAnimName] = []
			const animRanges = actorAnim as [[number, number], [number, number]]
			for (let x = animRanges[0][0]; x <= animRanges[1][0]; x++)
				for (let y = animRanges[0][1]; y <= animRanges[1][1]; y++)
					data.actorMapping[actorAnimsName][actorAnimName].push([x, y])
		} else
			data.actorMapping[actorAnimsName][actorAnimName] = [
				actorAnim as [number, number],
			]
	}
}
/**
 * Converts a direction to x and y multipliers
 * @param direction
 */
function convertDirection(direction: Direction): [number, number] {
	switch (direction) {
		case Direction.UP:
			return [0, -1]
		case Direction.RIGHT:
			return [1, 0]
		case Direction.DOWN:
			return [0, 1]
		case Direction.LEFT:
			return [-1, 0]
	}
}

const tileSize = 32 as const

// TODO Custom tilsets
const fetchTiles = (async (): Promise<SizedWebGLTexture> =>
	renderer.addTexture(
		await removeBackground("./data/img/tiles.png", 0x52ce6b)
	))()

export default class Renderer {
	ready: Promise<void>
	readyBool = false
	// @ts-expect-error We don't use it unless we have it
	renderTexture: SizedWebGLTexture
	// @ts-expect-error We don't use it unless we have it
	backgroundFiller: SizedWebGLTexture
	/**
	 * Initializes the renderer, optional `this.ready` promise
	 * @param level
	 */
	constructor(
		public level: LevelState,
		public renderSpace?: HTMLElement | null,
		public itemSpace?: HTMLElement | null
	) {
		renderer.scaling = 2
		;[renderer.canvas.width, renderer.canvas.height] = [
			level.cameraType.width * tileSize,
			level.cameraType.height * tileSize,
		]
		renderer.updateSize()
		this.ready = (async () => {
			this.renderTexture = await fetchTiles
			this.readyBool = true
			const ctx = document.createElement("canvas").getContext("2d")
			if (!ctx) return
			ctx.canvas.width = (this.level.cameraType.width + 1) * tileSize
			ctx.canvas.height = (this.level.cameraType.height + 1) * tileSize
			const img = await new Promise<HTMLImageElement>(res => {
				const img = new Image()
				img.addEventListener("load", () => res(img))
				img.src = this.renderTexture.source
			})
			for (let x = 0; x < this.level.cameraType.width + 1; x++)
				for (let y = 0; y < this.level.cameraType.height + 1; y++)
					ctx.drawImage(
						img,
						data.actorMapping.floor.normal[0][0] * tileSize,
						data.actorMapping.floor.normal[0][1] * tileSize,
						tileSize,
						tileSize,
						x * tileSize,
						y * tileSize,
						tileSize,
						tileSize
					)
			this.backgroundFiller = await renderer.addTexture(
				await canvasToBlobURI(ctx.canvas)
			)
			// Add the canvas that Pixi automatically created for you to the HTML document
			renderSpace?.appendChild(renderer.canvas)
		})()
	}
	/**
	 * Updates the positions of the rendred sprites
	 */
	frame(): void {
		if (!this.readyBool) return
		// Update the camera ASAP
		let cameraPos: [number, number] = [0, 0]
		if (this.level.selectedPlayable) {
			const movedPos = [
				this.level.selectedPlayable.tile.x,
				this.level.selectedPlayable.tile.y,
			]
			if (
				this.level.selectedPlayable.cooldown &&
				this.level.selectedPlayable.currentMoveSpeed
			) {
				const mults = convertDirection(this.level.selectedPlayable.direction)
				const offsetMult =
					1 -
					(this.level.selectedPlayable.currentMoveSpeed -
						this.level.selectedPlayable.cooldown +
						1) /
						this.level.selectedPlayable.currentMoveSpeed
				movedPos[0] -= offsetMult * mults[0]
				movedPos[1] -= offsetMult * mults[1]
			}
			cameraPos = [
				Math.max(
					0,
					Math.min(
						movedPos[0] + 0.5,
						this.level.width - this.level.cameraType.width / 2
					) -
						this.level.cameraType.width / 2
				),
				Math.max(
					0,
					Math.min(
						movedPos[1] + 0.5,
						this.level.height - this.level.cameraType.height / 2
					) -
						this.level.cameraType.height / 2
				),
			]
			renderer.cameraPosition = [
				cameraPos[0] * tileSize,
				cameraPos[1] * tileSize,
			]
		}
		renderer.drawImage(
			this.backgroundFiller.texture,
			this.backgroundFiller.width,
			this.backgroundFiller.height,
			0,
			0,
			this.backgroundFiller.width,
			this.backgroundFiller.height,
			renderer.cameraPosition[0] - (renderer.cameraPosition[0] % tileSize),
			renderer.cameraPosition[1] - (renderer.cameraPosition[1] % tileSize),
			this.backgroundFiller.width,
			this.backgroundFiller.height
		)
		const sortedActors = this.level.activeActors.sort(
			(a, b) => a.layer - b.layer
		)
		for (const actor of sortedActors) {
			if (
				actor.tile.x < Math.floor(cameraPos[0] - 1) ||
				actor.tile.x >
					Math.ceil(cameraPos[0] + this.level.cameraType.width + 1) ||
				actor.tile.y < Math.floor(cameraPos[1] - 1) ||
				actor.tile.y >
					Math.ceil(cameraPos[1] + this.level.cameraType.height + 1)
			)
				continue
			const movedPos = [actor.tile.x, actor.tile.y]
			if (actor.cooldown && actor.currentMoveSpeed) {
				const mults = convertDirection(actor.direction)
				const offsetMult =
					1 -
					(actor.currentMoveSpeed - actor.cooldown + 1) / actor.currentMoveSpeed
				movedPos[0] -= offsetMult * mults[0]
				movedPos[1] -= offsetMult * mults[1]
			}

			const art =
				typeof actor.art === "function"
					? actor.art()
					: actor.art ?? { actorName: "unknown" }
			const frame =
				data.actorMapping[art.actorName]?.[art.animation ?? "default"]?.[
					art.frame ?? 0
				] ?? data.actorMapping.floor.normal[0]
			renderer.drawImage(
				this.renderTexture.texture,
				this.renderTexture.width,
				this.renderTexture.height,
				frame[0] * tileSize,
				frame[1] * tileSize,
				tileSize,
				tileSize,
				movedPos[0] * tileSize,
				movedPos[1] * tileSize,
				tileSize,
				tileSize
			)
			// [movedPos[0] * tileSize, movedPos[1] * tileSize]
		}
	}
	destroy(): void {
		this.renderSpace?.removeChild(renderer.canvas)
	}
}
