type AnyFunction = (...args: any[]) => any

export class TimeoutTimer {
	id: number
	constructor(callback: AnyFunction, time: number) {
		this.id = setTimeout(callback, time * 1000)
	}
	cancel(): void {
		clearTimeout(this.id)
	}
}

export class IntervalTimer {
	id: number
	constructor(callback: AnyFunction, time: number) {
		this.id = setInterval(callback, time * 1000)
	}
	cancel(): void {
		clearInterval(this.id)
	}
}

export class TimeoutIntervalTimer {
	id: number
	constructor(public callback: AnyFunction, public time: number) {
		this.nextCall = this.nextCall.bind(this)
		this.id = setTimeout(this.nextCall, time * 1000)
	}
	nextCall(): void {
		this.id = setTimeout(this.nextCall, this.time * 1000)
		this.callback()
	}
	cancel(): void {
		clearTimeout(this.id)
	}
}

export class AnimationTimer {
	id: number
	constructor(public callback: AnyFunction) {
		this.nextCall = this.nextCall.bind(this)
		this.id = requestAnimationFrame(this.nextCall)
	}
	nextCall(): void {
		this.id = requestAnimationFrame(this.nextCall)
		this.callback()
	}
	cancel(): void {
		cancelAnimationFrame(this.id)
	}
}

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

/**
 * A hack to remove all event listeners for an HTMLElement's children. Also
 * stops the current animation and all references to the children.
 */
export function resetListeners(el: HTMLElement): void {
	// eslint-disable-next-line no-self-assign
	el.innerHTML = el.innerHTML
}
