let uiColorStyle: HTMLStyleElement | undefined

export function setColorScheme(hue: number, saturation: number): void {
	if (!uiColorStyle) {
		uiColorStyle = document.createElement("style")
		uiColorStyle.id = "uiColorStyle"
		document.head.appendChild(uiColorStyle)
	}
	uiColorStyle.innerText = `:root {
	--hue: ${hue};
	--saturation: ${saturation}%;
`
}

if (location.href.includes("randomcolor"))
	setColorScheme(Math.random() * 360, Math.random() * 100)
