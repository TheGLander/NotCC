import dpadImage from "./dpad.svg"
import { RepeatKeyHandler } from "@/inputs"
import { KEY_INPUTS, KeyInputs } from "@notcc/logic"
import { memo } from "preact/compat"
import { useEffect, useRef } from "preact/hooks"
import dropActiveImage from "./drop-active.svg"
import dropInactiveImage from "./drop-inactive.svg"
import cycleActiveImage from "./cycle-active.svg"
import cycleInactiveImage from "./cycle-inactive.svg"
import switchActiveImage from "./switch-active.svg"
import switchInactiveImage from "./switch-inactive.svg"
import { applyRef } from "@/helpers"
import { Ref } from "preact"

const MOBILE_CONTROLS_PLAYER_N = 0

export const MobileControls = memo(function MobileControls(props: {
	handler: RepeatKeyHandler
	possibleActionsRef: Ref<(actions: KeyInputs) => void>
}) {
	const onOffRef = useRef<
		| [
				(key: KeyInputs, player: number) => void,
				(key: KeyInputs, player: number) => void,
		  ]
		| null
	>(null)

	useEffect(() => {
		props.handler.addEventSource((on, off) => {
			onOffRef.current = [on, off]
			return () => {}
		})
	}, [props.handler])

	const inputsRef = useRef<KeyInputs>(0)
	function updateDpadDeltas(inputs: KeyInputs) {
		const oldInputs = inputsRef.current
		const [on, off] = onOffRef!.current!
		for (let input = KEY_INPUTS.up; input <= KEY_INPUTS.left; input <<= 1) {
			if (input & inputs && !(input & oldInputs)) {
				on(input, MOBILE_CONTROLS_PLAYER_N)
			}
			if (!(input & inputs) && input & oldInputs) {
				off(input, MOBILE_CONTROLS_PLAYER_N)
			}
		}
		inputsRef.current = inputs
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
		updateDpadDeltas(
			0 |
				(x < 1 / 3 ? KEY_INPUTS.left : 0) |
				(x > 2 / 3 ? KEY_INPUTS.right : 0) |
				(y < 1 / 3 ? KEY_INPUTS.up : 0) |
				(y > 2 / 3 ? KEY_INPUTS.down : 0)
		)
	}
	function handleDpadRelease() {
		updateDpadDeltas(0)
	}

	const secondaryRefs = {
		drop: useRef<HTMLImageElement>(null),
		cycle: useRef<HTMLImageElement>(null),
		switch: useRef<HTMLImageElement>(null),
	}
	function updatePossibleActions(actions: KeyInputs) {
		if (secondaryRefs.drop.current) {
			secondaryRefs.drop.current.src =
				actions & KEY_INPUTS.dropItem ? dropActiveImage : dropInactiveImage
		}
		if (secondaryRefs.cycle.current) {
			secondaryRefs.cycle.current.src =
				actions & KEY_INPUTS.cycleItems ? cycleActiveImage : cycleInactiveImage
		}
		if (secondaryRefs.switch.current) {
			secondaryRefs.switch.current.src =
				actions & KEY_INPUTS.switchPlayer
					? switchActiveImage
					: switchInactiveImage
		}
	}
	useEffect(() => {
		applyRef(props.possibleActionsRef, updatePossibleActions)
	}, [props.possibleActionsRef])

	function handleSecondaryDown(input: KeyInputs) {
		return () => {
			const [on] = onOffRef!.current!
			on(input, MOBILE_CONTROLS_PLAYER_N)
		}
	}
	function handleSecondaryUp(input: KeyInputs) {
		return () => {
			const [, off] = onOffRef!.current!
			off(input, MOBILE_CONTROLS_PLAYER_N)
		}
	}

	return (
		<div class="pointer-events-none fixed bottom-0 left-0 right-0 top-0 portrait:bottom-[theme(spacing.20)] landscape:left-[theme(spacing.20)]">
			<img
				class="pointer-events-auto absolute bottom-[25vmin] left-[5vmin] w-[12vmin] landscape:bottom-[25vmin]"
				draggable={false}
				ref={secondaryRefs.drop}
				src={dropInactiveImage}
				onTouchStart={handleSecondaryDown(KEY_INPUTS.dropItem)}
				onTouchEnd={handleSecondaryUp(KEY_INPUTS.dropItem)}
			/>
			<img
				class="pointer-events-auto absolute bottom-[25vmin] left-[22vmin] w-[12vmin] landscape:bottom-[25vmin]"
				draggable={false}
				ref={secondaryRefs.cycle}
				src={cycleInactiveImage}
				onTouchStart={handleSecondaryDown(KEY_INPUTS.cycleItems)}
				onTouchEnd={handleSecondaryUp(KEY_INPUTS.cycleItems)}
			/>
			<img
				class="pointer-events-auto absolute bottom-[6vmin] left-[13vmin] w-[12vmin] landscape:bottom-[6vmin]"
				draggable={false}
				ref={secondaryRefs.switch}
				src={switchInactiveImage}
				onTouchStart={handleSecondaryDown(KEY_INPUTS.switchPlayer)}
				onTouchEnd={handleSecondaryUp(KEY_INPUTS.switchPlayer)}
			/>
			<img
				class="pointer-events-auto absolute bottom-[4vmin] right-[5vmin] w-[40vmin] landscape:bottom-[5vmin]"
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
})
