import {
	getWebGLContext,
	createProgramInfo,
	createTexture,
	ProgramInfo,
	BufferInfo,
	primitives,
	drawBufferInfo,
	setUniforms,
	setBuffersAndAttributes,
	m4,
	TextureFunc,
} from "twgl.js"

export interface SizedWebGLTexture {
	width: number
	height: number
	srcCoords?: [number, number]
	srcSize?: [number, number]
	texture: WebGLTexture
	source:
		| string
		| number[]
		| ArrayBufferView
		| TexImageSource
		| TexImageSource[]
		| string[]
		| TextureFunc
	image: TexImageSource
}

export class WebGLRenderer {
	canvas: HTMLCanvasElement
	gl: WebGLRenderingContext
	programInfo: ProgramInfo
	bufferInfo: BufferInfo
	cameraPosition: [number, number] = [0, 0]
	scaling = 1
	constructor() {
		this.canvas = document.createElement("canvas")
		this.canvas.classList.add("renderer")
		this.canvas.addEventListener("resize", () => this.updateSize())
		this.gl = getWebGLContext(this.canvas, {
			// Meh
			alpha: true,
			// Ew blurry pixel art
			antialias: true,
			// Emulates a dumb CC2 tearing effect with some weird tiles
			preserveDrawingBuffer: true,
		})
		this.gl.enable(this.gl.BLEND)
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
		this.programInfo = createProgramInfo(this.gl, [
			`// we will always pass a 0 to 1 unit quad
// and then use matrices to manipulate it
attribute vec4 position;   

uniform mat4 matrix;
uniform mat4 textureMatrix;

varying vec2 texcoord;

void main () {
  gl_Position = matrix * position;
  texcoord = (textureMatrix * position).xy;
}`,
			`precision mediump float;

varying vec2 texcoord;
uniform bool isWrap;
uniform vec2 wrapLen;
uniform sampler2D texture;

void main() {
	gl_FragColor = texture2D(texture, texcoord);
}`,
		])
		this.bufferInfo = primitives.createXYQuadBufferInfo(this.gl, 1, 0.5, 0.5)
		this.gl.useProgram(this.programInfo.program)
		// calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
		setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo)
	}
	updateSize(): void {
		this.canvas.style.height = `${this.canvas.height * this.scaling}px`
		this.canvas.style.width = `${this.canvas.width * this.scaling}px`
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
	}
	addTexture(
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
					this.gl,
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
				texture: createTexture(this.gl, { src: source }),
				source,
				image: source,
			})
	}
	drawImage(
		tex: WebGLTexture,
		texWidth: number,
		texHeight: number,
		srcX: number,
		srcY: number,
		srcWidth: number,
		srcHeight: number,
		dstX: number,
		dstY: number,
		dstWidth: number,
		dstHeight: number
	): void {
		const mat = m4.identity()
		const tmat = m4.identity()
		const uniforms = {
			matrix: mat,
			textureMatrix: tmat,
			texture: tex,
		}

		// these adjust the unit quad to generate texture coordinates
		// to select part of the src texture
		m4.translate(tmat, [srcX / texWidth, srcY / texHeight, 0], tmat)
		m4.scale(tmat, [srcWidth / texWidth, srcHeight / texHeight, 1], tmat)

		// these convert from pixels to clip space
		m4.translate(mat, [-1, 1, 0], mat)
		m4.scale(mat, [2 / this.canvas.width, -2 / this.canvas.height, 1], mat)
		// these move and scale the unit quad into the size we want
		// in the target as pixels
		m4.translate(
			mat,
			[
				dstX - Math.round(this.cameraPosition[0]),
				dstY - Math.round(this.cameraPosition[1]),
				0,
			],
			mat
		)
		m4.scale(mat, [dstWidth, dstHeight, 1], mat)

		// calls gl.uniformXXX, gl.activeTexture, gl.bindTexture
		setUniforms(this.programInfo, uniforms)
		// calls gl.drawArray or gl.drawElements
		drawBufferInfo(this.gl, this.bufferInfo, this.gl.TRIANGLES)
	}
}
