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
		//this.ctx.set(0, 0, this.canvas.width, this.canvas.height)
	}
	/*addTexture(
		source:
			| string
			| number[]
			| ArrayBufferView
			| TexImageSource
			| TexImageSource[]
			| string[]
			| TextureFunc
	): Promise<SizedWebGLTexture> {
		if (!(source instanceof HTMLElement))
			return new Promise<SizedWebGLTexture>((res, rej) => {
				createTexture(
					this.ctx,
					{
						src: source,
					},
					(err, tex, src: HTMLImageElement | HTMLImageElement[]) => {
						if (err) {
							rej(err)
							return
						}
						if (src instanceof Array) src = src[0]
						res({
							height: src.height,
							width: src.width,
							texture: tex,
							source,
							image: src,
						})
					}
				)
			})
		// Fun fact: "instant" loading from elements just doesn't call the callback, so do an emulation of that here in case of an element
		else
			return Promise.resolve({
				height: source.height,
				width: source.width,
				texture: createTexture(this.ctx, { src: source }),
				source,
				image: source,
			})
	}*/
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
