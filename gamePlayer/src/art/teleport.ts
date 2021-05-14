import { artDB } from "../const"
import { genericAnimatedArt } from "../visuals"

for (const color of ["red", "blue", "yellow", "green"])
	artDB[
		`teleport${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`
	] = genericAnimatedArt(
		`teleport${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`,
		4
	)
