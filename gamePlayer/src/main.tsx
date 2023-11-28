import { hydrate } from "preact"
import { App } from "./app"

hydrate(<App />, document.querySelector("#app")!)
