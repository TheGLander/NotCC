import { artDB } from "../const"

for (const color of [
	"green",
	"blue",
	"brown",
	"red",
	"orange",
	"gray",
	"pink",
	"black",
])
	artDB[`button${color[0].toUpperCase()}${color.substr(1).toLowerCase()}`] = {
		actorName: "button",
		animation: color,
	}
