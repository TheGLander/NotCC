/// <reference types="vite-plugin-pwa/client" />
import { hydrate } from "preact"
import { App } from "./app"
import { registerSW } from "virtual:pwa-register"
registerSW({ immediate: true })

hydrate(<App />, document.querySelector("#app")!)
