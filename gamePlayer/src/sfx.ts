import { LevelSetLoaderFunction } from "@notcc/logic"
export const SFX_FILENAME_MAP = {
	"recessed wall": "newwall",
	explosion: "burn",
	splash: "splash",
	teleport: "teleport",
	robbed: "thief",
	"dirt clear": "dirt",
	"button press": "button",
	"block push": "push",
	"force floor": "force",
	bump: "wall",
	"water step": "water",
	"slide step": "ice",
	"ice slide": "slide",
	"fire step": "fire",
	"item get": "get",
	"socket unlock": "socket",
	"door unlock": "door",
	"chip win": "teleport-male",
	"melinda win": "teleport-female",
	"chip death": "BummerM",
	"melinda death": "BummerF",
}

async function tryGetSfxFile(
	loader: LevelSetLoaderFunction,
	sfxName: string
): Promise<ArrayBuffer | null> {
	for (const ext of ["ogg", "wav", "WAV"]) {
		try {
			return (await loader(`${sfxName}.${ext}`, true)) as ArrayBuffer
		} catch {
			continue
		}
	}
	return null
}

export class AudioSfxManager {
	ctx = new AudioContext()
	audioBuffers: Record<string, AudioBuffer> = {}
	playingNodes: Record<string, AudioBufferSourceNode> = {}
	async loadSfx(loader: LevelSetLoaderFunction): Promise<void> {
		this.stopAllSfx()
		this.audioBuffers = {}
		let anySfxLoaded = false
		for (const [internalName, fileName] of Object.entries(SFX_FILENAME_MAP)) {
			const buffer = await tryGetSfxFile(loader, fileName)
			if (!buffer) continue
			const audioBuffer = await this.ctx.decodeAudioData(buffer)
			this.audioBuffers[internalName] = audioBuffer
			anySfxLoaded = true
		}
		if (!anySfxLoaded) {
			throw new Error("Couldn't load any sfx")
		}
	}
	getSfxNode(sfx: string): AudioBufferSourceNode | null {
		const audioBuffer = this.audioBuffers[sfx]
		if (audioBuffer === undefined) {
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
	playOnceAsync(sfx: string): Promise<void> {
		this.stopSfx(sfx)
		const node = this.getSfxNode(sfx)
		if (node === null) return Promise.reject()
		return new Promise(res => {
			node.addEventListener("ended", () => {
				if (this.playingNodes[sfx] === node) {
					res()
					delete this.playingNodes[sfx]
				}
			})
			node.start()
		})
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
