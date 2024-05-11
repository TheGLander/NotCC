import { useAtomValue } from "jotai"
import { tilesetAtom } from "./PreferencesPrompt/TilesetsPrompt"
import { Art, Frame, Tileset } from "./GameRenderer/renderer"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks"
import { AnimationTimer, IntervalTimer } from "@/helpers"
import { Direction } from "@notcc/logic"
import spinnerImg from "@/spinner.gif"

function PlainThrobber() {
	return (
		<img
			alt=""
			src={spinnerImg}
			class="h-[32px] w-[32px] [image-rendering:pixelated]"
		/>
	)
}

function renderArt(
	ctx: CanvasRenderingContext2D,
	tileset: Tileset,
	art: Art,
	extraInfo: {
		tick: number
		direction: Direction
		state: (art: Record<string, Art | string>) => string
	}
) {
	if (!art) {
	} else if (Array.isArray(art)) {
		const tsize = tileset.tileSize
		ctx.drawImage(
			tileset.image,
			art[0] * tsize,
			art[1] * tsize,
			tsize,
			tsize,
			0,
			0,
			tsize,
			tsize
		)
	} else if (art.type === "directic") {
		renderArt(
			ctx,
			tileset,
			art[Direction[extraInfo.direction] as "UP"],
			extraInfo
		)
	} else if (art.type === "animated" || art.type === "directional") {
		let frames: Frame[]
		if (art.type === "directional") {
			frames = art[Direction[extraInfo.direction] as "UP"]
		} else {
			frames = art.frames
		}
		const duration = art.duration === "steps" ? 60 / 5 : art.duration
		const frame =
			frames[Math.floor(frames.length * ((extraInfo.tick / duration) % 1))]
		renderArt(ctx, tileset, frame, extraInfo)
	} else if (art.type === "overlay") {
		renderArt(ctx, tileset, art.bottom, extraInfo)
		renderArt(ctx, tileset, art.top, extraInfo)
	} else if (art.type === "state") {
		renderArt(ctx, tileset, art[extraInfo.state(art)] as Art, extraInfo)
	} else {
		throw new Error("Not implemented")
	}
}

function TileThrobber(props: {
	art: Exclude<Art, null | Frame>
	tileset: Tileset
}) {
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	const ctx = useMemo(() => canvas?.getContext("2d"), [canvas])

	const direction = useMemo(() => Math.floor(Math.random() * 4), [props.art])
	const [state, setState] = useState<string | null>(null)

	const timePassedRef = useRef(0)
	const lastCalledRef = useRef(performance.now())
	useLayoutEffect(() => {
		setState(null)
	}, [props.art])

	const render = useCallback(() => {
		const now = performance.now()
		timePassedRef.current += now - lastCalledRef.current
		lastCalledRef.current = now
		const curSubtick = Math.floor((timePassedRef.current / 1000) * 60)
		if (!ctx) return
		ctx.clearRect(0, 0, props.tileset.tileSize, props.tileset.tileSize)
		renderArt(ctx, props.tileset, props.art, {
			tick: curSubtick,
			direction,
			state(art) {
				if (state) return state
				const states = Object.keys(art)
				states.splice(states.indexOf("type"), 1)
				const newState = states[Math.floor(Math.random() * states.length)]
				setState(newState)
				return newState
			},
		})
	}, [ctx, direction, props.tileset, props.art, state])
	useEffect(() => {
		const timer = new AnimationTimer(render)
		return () => timer.cancel()
	}, [render])

	return (
		<canvas
			width={props.tileset.tileSize}
			height={props.tileset.tileSize}
			ref={setCanvas}
			class="h-[32px] w-[32px] [image-rendering:pixelated]"
		/>
	)
}

const ALLOWED_THROBBER_ACTORS = [
	"chip",
	"melinda",
	"centipede",
	"ant",
	"glider",
	"mirrorChip",
	"mirrorMelinda",
	"water",
	"teethRed",
	"teethBlue",
	"tankBlue",
	"tankYellow",
	"toggleWall",
	"holdWall",
	"forceFloorRandom",
	"fire",
	"exit",
]

function getRandomActor() {
	return ALLOWED_THROBBER_ACTORS[
		Math.floor(Math.random() * ALLOWED_THROBBER_ACTORS.length)
	]
}

export function Throbber() {
	const tileset = useAtomValue(tilesetAtom)
	const [chosenTile, setChosenTile] = useState<string>(getRandomActor)
	useEffect(() => {
		if (!tileset) return
		const timer = new IntervalTimer(() => {
			setChosenTile(getRandomActor())
		}, 2)
		return () => {
			timer.cancel()
		}
	}, [tileset])
	if (!tileset) return <PlainThrobber />
	const tileArt = tileset.art.artMap[chosenTile]
	if (Array.isArray(tileArt) || tileArt === null) return <PlainThrobber />
	return <TileThrobber art={tileArt} tileset={tileset} />
}
