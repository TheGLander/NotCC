import { renderToString } from "preact-render-to-string"
import { App } from "./app"

export function renderSsgString(): string {
	return renderToString(<App />)
}
