import { actorDB, registerTaggedType } from "./const.js"

export * from "./level.js"
export * from "./actor.js"
export * from "./tile.js"
export * from "./levelset.js"
export * from "./const.js"
export * from "./helpers.js"
export * from "./parsers/c2m.js"
export * from "./parsers/c2g.js"
export * from "./parsers/nccs.js"
export * from "./actors/index.js"
export * from "./wires.js"
export * from "./attemptTracker.js"
export * from "./inputs.js"

for (const actor in actorDB) {
	registerTaggedType(actorDB[actor])
}
