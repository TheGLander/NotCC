export class KeyListener {
	removed = false
	constructor(
		public on: (ev: KeyboardEvent) => void,
		public off?: (ev: KeyboardEvent) => void
	) {
		document.addEventListener("keydown", on)
		if (off) {
			document.addEventListener("keyup", off)
		}
	}
	remove(): void {
		if (this.removed)
			throw new Error("This key listener has already been removed.")
		this.removed = true
		document.removeEventListener("keydown", this.on)
		if (this.off) {
			document.removeEventListener("keyup", this.off)
		}
	}
}
