function isModalPresent(): boolean {
	return !!document.querySelector(":modal")
}

export class KeyListener {
	removed = false
	onListener(ev: KeyboardEvent): void {
		if (isModalPresent()) return
		this.userOn(ev)
	}
	offListener(ev: KeyboardEvent): void {
		if (isModalPresent()) return
		// The off listener is only set up if `userOff` is present, so we don't
		// need a check for undefined here
		this.userOff!(ev)
	}
	constructor(
		public userOn: (ev: KeyboardEvent) => void,
		public userOff?: (ev: KeyboardEvent) => void
	) {
		this.onListener = this.onListener.bind(this)
		document.addEventListener("keydown", this.onListener)
		if (userOff) {
			this.offListener = this.offListener.bind(this)
			document.addEventListener("keyup", this.offListener)
		}
	}
	remove(): void {
		if (this.removed)
			throw new Error("This key listener has already been removed.")
		this.removed = true
		document.removeEventListener("keydown", this.onListener)
		if (this.userOff) {
			document.removeEventListener("keyup", this.offListener)
		}
	}
}
