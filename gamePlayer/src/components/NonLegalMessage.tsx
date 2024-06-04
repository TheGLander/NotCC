import { protobuf } from "@notcc/logic"
import { Expl } from "./Expl"

const KnownGlitches = protobuf.GlitchInfo.KnownGlitches

interface GlitchText {
	name: string
	prevent?: string
}

export const glitchNames: Record<
	protobuf.GlitchInfo.KnownGlitches,
	GlitchText
> = {
	[KnownGlitches.INVALID]: { name: "???" },
	[KnownGlitches.DESPAWN]: { name: "Despawn" },
	[KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT]: {
		name: "Simultaneous character movement",
		prevent:
			'Don\'t hold down any movement keys while switching players. Alternatively, enable "Prevent simultaneous character movement" in preferences.',
	},
	[KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING]: {
		name: "Dynamite explosion sneaking",
		prevent: "Don't move inwards into a dynamite's explosion ring.",
	},
}

const nonlegalGlitches: protobuf.GlitchInfo.KnownGlitches[] = [
	KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT,
	KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING,
]

const WIKI_URL = "https://wiki.bitbusters.club/"

export function isGlitchNonlegal(glitch: protobuf.IGlitchInfo): boolean {
	return !!glitch.glitchKind && nonlegalGlitches.includes(glitch.glitchKind)
}

export function NonlegalMessage(props: { glitch: protobuf.IGlitchInfo }) {
	const glitchText = glitchNames[props.glitch.glitchKind!]
	return (
		<>
			<strong>{glitchText.name}</strong>, a non-scoreboard-legal glitch
			<Expl>
				a glitch which is considered by the community to not be allowed for
				scored playthroughs
			</Expl>
			, has occured. Level solutions which utilize nonlegal glitches are stopped
			prematurely to prevent confusion as to which solutions are
			scoreboard-legal. This behavior can be changed in preferences.
			{glitchText.prevent && (
				<>
					<br />
					<br />
					To prevent the glitch from occuring, do the following:{" "}
					{glitchText.prevent}
				</>
			)}
			<br />
			<br />
			<a target="_blank" href={`${WIKI_URL}${glitchText.name}`}>
				Read more about the glitch here.
			</a>
		</>
	)
}
