export class WebGLRenderer {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	cameraPosition: [number, number] = [0, 0]
	scaling = 1
	constructor() {
		this.canvas = document.createElement("canvas")
		this.canvas.classList.add("renderer")
		this.canvas.addEventListener("resize", () => this.updateSize())
		this.ctx = this.canvas.getContext("2d", {
			// Meh
			alpha: true,
			// Ew blurry pixel art
			antialias: false,
			// Emulates a dumb CC2 tearing effect with some weird tiles
			preserveDrawingBuffer: true,
		}) as CanvasRenderingContext2D
	}
	updateSize(): void {
		this.canvas.style.height = `${this.canvas.height * this.scaling}px`
		this.canvas.style.width = `${this.canvas.width * this.scaling}px`
	}
	drawImage(
		tex: CanvasImageSource,
		srcX: number,
		srcY: number,
		srcWidth: number,
		srcHeight: number,
		dstX: number,
		dstY: number,
		dstWidth: number,
		dstHeight: number,
		alphaMult = 1,
		rotation = 0
	): void {
		dstX -= Math.round(this.cameraPosition[0])
		dstY -= Math.round(this.cameraPosition[1])
		if (rotation !== 0) {
			this.ctx.translate(dstX + dstWidth / 2, dstY + dstHeight / 2)
			this.ctx.rotate(rotation)
			this.ctx.translate(-dstX - dstWidth / 2, -dstY - dstHeight / 2)
		}
		this.ctx.globalAlpha = alphaMult
		this.ctx.drawImage(
			tex,
			srcX,
			srcY,
			srcWidth,
			srcHeight,
			dstX,
			dstY,
			dstWidth,
			dstHeight
		)
		if (rotation !== 0) {
			this.ctx.resetTransform()
		}
	}
}
