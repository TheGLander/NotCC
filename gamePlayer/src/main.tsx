import { hydrate } from "preact"
import { App } from "./app"
import * as fs from "@/fs"

hydrate(<App />, document.querySelector("#app")!)

// @ts-ignore
globalThis.NotCC = {
	fs,
}
