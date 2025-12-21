// A straight port of `application-config-path`, but for Neutralino

import { os } from "@neutralinojs/lib"
import path from "path-browserify"

let configPath: string | null = null

async function darwin(name: string) {
	return path.join(
		await os.getEnv("HOME"),
		"Library",
		"Application Support",
		name
	)
}

async function xdg(name: string) {
	if (await os.getEnv("XDG_DATA_HOME")) {
		return path.join(await os.getEnv("XDG_DATA_HOME"), name)
	}

	return path.join(await os.getEnv("HOME"), ".local", "share", name)
}

async function win32(name: string) {
	if (await os.getEnv("APPDATA")) {
		return path.join(await os.getEnv("APPDATA"), name)
	}
	return path.join(await os.getEnv("USERPROFILE"), "AppData", "Roaming", name)
}

export async function applicationConfigPath(name: string): Promise<string> {
	if (typeof name !== "string") {
		throw new TypeError("`name` must be string")
	}

	if (configPath !== null) return configPath

	switch ((globalThis as any).NL_OS.toLowerCase()) {
		case "darwin":
			configPath = await darwin(name)
			break
		case "linux":
			configPath = await xdg(name)
			break
		case "windows":
			configPath = await win32(name)
			break
		default:
			throw new Error("Platform not supported")
	}
	return configPath
}
