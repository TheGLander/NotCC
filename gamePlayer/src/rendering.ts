import * as twgl from "twgl.js"

export interface SizedWebGLTexture {
	width: number
	height: number
	srcCoords?: [number, number]
	srcSize?: [number, number]
	texture: WebGLTexture
	source: string
	image: HTMLImageElement
}

export class WebGLRenderer {
	canvas: HTMLCanvasElement
	gl: WebGLRenderingContext
	programInfo: twgl.ProgramInfo
	bufferInfo: twgl.BufferInfo
	textures: Record<string, SizedWebGLTexture> = {}
	cameraPosition: [number, number] = [0, 0]
	scaling = 1
	constructor() {
		this.canvas = document.createElement("canvas")
		this.canvas.classList.add("renderer")
		this.canvas.addEventListener("resize", () => this.updateSize())
		this.gl = twgl.getWebGLContext(this.canvas, {
			alpha: true,
			antialias: true,
		})
		this.gl.enable(this.gl.BLEND)
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
		this.programInfo = twgl.createProgramInfo(this.gl, [
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
		this.bufferInfo = twgl.primitives.createXYQuadBufferInfo(
			this.gl,
			1,
			0.5,
			0.5
		)
	}
	updateSize(): void {
		this.canvas.style.height = `${this.canvas.height * this.scaling}px`
		this.canvas.style.width = `${this.canvas.width * this.scaling}px`
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
	}
	addTexture(source: string): Promise<SizedWebGLTexture> {
		return new Promise<SizedWebGLTexture>((res, rej) => {
			twgl.createTexture(
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
					this.textures[source] = {
						height: src.height,
						width: src.width,
						texture: tex,
						source,
						image: src,
					}
					res(this.textures[source])
				}
			)
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
		const mat = twgl.m4.identity()
		const tmat = twgl.m4.identity()
		const uniforms = {
			matrix: mat,
			textureMatrix: tmat,
			texture: tex,
		}

		// these adjust the unit quad to generate texture coordinates
		// to select part of the src texture
		twgl.m4.translate(tmat, [srcX / texWidth, srcY / texHeight, 0], tmat)
		twgl.m4.scale(tmat, [srcWidth / texWidth, srcHeight / texHeight, 1], tmat)

		// these convert from pixels to clip space
		twgl.m4.translate(mat, [-1, 1, 0], mat)
		twgl.m4.scale(mat, [2 / this.canvas.width, -2 / this.canvas.height, 1], mat)
		// these move and scale the unit quad into the size we want
		// in the target as pixels
		twgl.m4.translate(
			mat,
			[
				dstX - Math.round(this.cameraPosition[0]),
				dstY - Math.round(this.cameraPosition[1]),
				0,
			],
			mat
		)
		twgl.m4.scale(mat, [dstWidth, dstHeight, 1], mat)

		this.gl.useProgram(this.programInfo.program)
		// calls gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
		twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo)
		// calls gl.uniformXXX, gl.activeTexture, gl.bindTexture
		twgl.setUniforms(this.programInfo, uniforms)
		// calls gl.drawArray or gl.drawElements
		twgl.drawBufferInfo(this.gl, this.bufferInfo, this.gl.TRIANGLES)
	}
}
