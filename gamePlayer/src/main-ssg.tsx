import { renderToString } from "preact-render-to-string"
import { App } from "./app"
import { setSSG } from "./helpers"

export function renderSsgString(): string {
	setSSG(true)
	return renderToString(<App />)
}
