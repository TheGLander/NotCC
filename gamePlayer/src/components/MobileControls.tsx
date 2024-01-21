import dpadImage from "@/dpad.svg"
import { RepeatKeyHandler } from "@/inputs"
import { InputType, KeyInputs, makeEmptyInputs } from "@notcc/logic"
import { useEffect, useRef } from "preact/hooks"

export function MobileControls(props: { handler: RepeatKeyHandler }) {
	const onOffRef = useRef<
		[(key: InputType) => void, (key: InputType) => void] | null
	>(null)

	useEffect(() => {
		props.handler.addEventSource((on, off) => {
			onOffRef.current = [on, off]
			return () => {}
		})
	}, [props.handler])

	const inputsRef = useRef(makeEmptyInputs())
	function updateDpadDeltas(inputs: Partial<KeyInputs>) {
		const oldInputs = inputsRef.current
		const [on, off] = onOffRef!.current!
		for (const [key, val] of Object.entries(inputs)) {
			if (val && !oldInputs[key as InputType]) {
				on(key as InputType)
			}
			if (!val && oldInputs[key as InputType]) {
				off(key as InputType)
			}
			oldInputs[key as InputType] = val
		}
	}

	const dpadRef = useRef<HTMLImageElement | null>(null)
	function handleDpadClick(ev: MouseEvent | TouchEvent) {
		if (!dpadRef.current) return
		ev.preventDefault()
		let x: number, y: number
		if (ev instanceof MouseEvent) {
			if (!ev.buttons) return
			x = ev.offsetX
			y = ev.offsetY
		} else {
			const dpadBox = dpadRef.current.getBoundingClientRect()
			const touches = Array.from(ev.targetTouches)
			const averageTouch = touches
				.map(touch => [touch.pageX - dpadBox.left, touch.pageY - dpadBox.top])
				.reduce((acc, val) => [acc[0] + val[0], acc[1] + val[1]], [0, 0])
			x = averageTouch[0] / touches.length
			y = averageTouch[1] / touches.length
		}
		x /= dpadRef.current.width
		y /= dpadRef.current.height
		updateDpadDeltas({
			left: x < 1 / 3,
			right: x > 2 / 3,
			up: y < 1 / 3,
			down: y > 2 / 3,
		})
	}
	function handleDpadRelease() {
		updateDpadDeltas({
			left: false,
			right: false,
			up: false,
			down: false,
		})
	}

	return (
		<div class="pointer-events-none fixed left-0 top-0 h-full w-full">
			<img
				class="pointer-events-auto absolute bottom-[10%] right-[10%] w-[40%]"
				src={dpadImage}
				draggable={false}
				ref={dpadRef}
				onMouseDown={handleDpadClick}
				onMouseMove={handleDpadClick}
				onMouseUp={handleDpadRelease}
				onTouchStart={handleDpadClick}
				onTouchMove={handleDpadClick}
				onTouchEnd={handleDpadClick}
			/>
		</div>
	)
}
