import { SfxManager } from "@notcc/logic"
const standardSfx = [
	"recessed wall",
	"explosion",
	"splash",
	"teleport",
	"robbed",
	"dirt clear",
	"button press",
	"block push",
	"force floor",
	"bump",
	"water step",
	"slide step",
	"ice slide",
	"fire step",
	"item get",
	"socket unlock",
	"door unlock",
	// TODO Win, loss SFX
]

export class AudioSfxManager implements SfxManager {
	ctx = new AudioContext()
	audioBuffers: Record<string, AudioBuffer> = {}
	playingNodes: Record<string, AudioBufferSourceNode> = {}
	async fetchDefaultSounds(url: string): Promise<void> {
		let anySfxLoaded = false
		for (const sfxName of standardSfx) {
			try {
				const res = await fetch(`${url}/${sfxName}.wav`)
				if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
				const buffer = await res.arrayBuffer()
				const audioBuffer = await this.ctx.decodeAudioData(buffer)
				this.audioBuffers[sfxName] = audioBuffer
				anySfxLoaded = true
			} catch (err) {
				console.error(`Couldn't load standard sound effect ${sfxName}: ${err}`)
			}
		}
		if (!anySfxLoaded)
			throw new Error("Couldn't load any standard sfx from url.")
	}
	getSfxNode(sfx: string): AudioBufferSourceNode | null {
		const audioBuffer = this.audioBuffers[sfx]
		if (audioBuffer === undefined) {
			if (!standardSfx.includes(sfx)) {
				console.warn(`Unknown sfx: ${sfx}`)
			}
			return null
		}
		const node = new AudioBufferSourceNode(this.ctx)
		node.buffer = audioBuffer
		node.connect(this.ctx.destination)
		this.playingNodes[sfx] = node
		return node
	}
	stopSfx(sfx: string): void {
		const node = this.playingNodes[sfx]
		if (node === undefined) return
		node.stop()
		node.disconnect()
		delete this.playingNodes[sfx]
	}
	playOnce(sfx: string): void {
		this.stopSfx(sfx)
		const node = this.getSfxNode(sfx)
		if (node === null) return
		node.addEventListener("ended", () => {
			if (this.playingNodes[sfx] === node) {
				delete this.playingNodes[sfx]
			}
		})
		node.start()
	}
	playContinuous(sfx: string): void {
		if (this.playingNodes[sfx] !== undefined) return
		const node = this.getSfxNode(sfx)
		if (node === null) return
		node.loop = true
		node.start()
	}
	stopContinuous(sfx: string): void {
		this.stopSfx(sfx)
	}
	stopAllSfx(): void {
		for (const sfxName of Object.keys(this.playingNodes)) {
			this.stopSfx(sfxName)
		}
	}
}
