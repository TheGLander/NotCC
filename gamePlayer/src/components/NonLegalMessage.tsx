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
			"Don't hold down any movement keys while switching players. Alternatively, if you're using the normal level player, enable \"Prevent simultaneous character movement\" in preferences.",
	},
	[KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING]: {
		name: "Dynamite explosion sneaking",
		prevent: "Don't move inwards into a dynamite's explosion ring.",
	},
	[KnownGlitches.DROP_BY_DESPAWNED]: {
		name: "Despawned item dropping",
		prevent:
			"Don't let any players or monsters drop items when despawned. This may be part of the level's design.",
	},
	[KnownGlitches.BLUE_TELEPORT_INFINITE_LOOP]: {
		name: "Invalid blue teleport destination travel",
		prevent:
			"Don't step in the unwired teleporters close to the top-left of the level. Contact the designer of the level about this, as this behavior is most likely unintetional.",
	},
}

const nonlegalGlitches: protobuf.GlitchInfo.KnownGlitches[] = [
	KnownGlitches.SIMULTANEOUS_CHARACTER_MOVEMENT,
	KnownGlitches.DYNAMITE_EXPLOSION_SNEAKING,
]

const WIKI_URL = "https://wiki.bitbusters.club/"

export function isGlitchKindNonlegal(
	glitchKind: protobuf.GlitchInfo.KnownGlitches
): boolean {
	return nonlegalGlitches.includes(glitchKind)
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

export function CrashMessage(props: { glitch: protobuf.IGlitchInfo }) {
	const glitchText = glitchNames[props.glitch.glitchKind!]
	return (
		<>
			<strong>{glitchText.name}</strong>, a game-crashing glitch, has occured.
			In the real game, this would have caused the program to close.
			{glitchText.prevent && (
				<>
					<br />
					<br />
					To prevent this glitch from occuring, do the following:{" "}
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
