import * as neutralino from "@neutralinojs/lib"
import { progressiveBodyDownload } from "./helpers"
import * as path from "path"

const UPDATE_INFO_URL =
	"https://glander.club/notcc/prewrite/desktop-update.json"

const desktopVersion = parseInt(import.meta.env.VITE_DESKTOP_VERSION)
declare const NL_PATH: string

async function downloadInstallResources(
	url: string,
	reportProgress?: (prog: number) => void
) {
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error("Failed to download update")
	}
	// Use raw Neutralino API to write to absolute path
	const updateFilePath = path.join(NL_PATH, ".tmp-downloaded-resources.neu")
	const baseFilePath = path.join(NL_PATH, "resources.neu")
	await neutralino.filesystem.writeBinaryFile(
		updateFilePath,
		await progressiveBodyDownload(res, reportProgress)
	)
	await neutralino.filesystem.move(updateFilePath, baseFilePath)
	console.log(`Copied ${updateFilePath} to ${baseFilePath}`)
}

export type UpdateInfo = {
	version?: number
	versionName?: string
	resourcesUrl?: string
	preInstall?: string
	insteadInstall?: string
	postInstall?: string
	notice?: string
}

function runServerCode(
	code: string,
	reportProgress?: (prog: number) => void
): void | Promise<void> {
	return new Function(
		"desktopVersion",
		"neutralino",
		"path",
		"reportProgress",
		code
	)(desktopVersion, neutralino, path, reportProgress)
}

declare const NL_ARGS: string[]

export async function installUpdate(
	info: UpdateInfo,
	reportProgress?: (prog: number) => void
): Promise<void> {
	if (!info.insteadInstall && !info.resourcesUrl)
		throw new Error("Install info is missing resource URL")
	if (info.preInstall) {
		await runServerCode(info.preInstall, reportProgress)
	}
	if (info.insteadInstall) {
		await runServerCode(info.insteadInstall, reportProgress)
	} else {
		await downloadInstallResources(info.resourcesUrl!, reportProgress)
	}
	if (info.postInstall) {
		await runServerCode(info.postInstall, reportProgress)
	} else {
		// If only we had `exec`..
		await neutralino.os.execCommand(
			NL_ARGS.map(v => (v.includes(" ") ? `"${v}"` : v)).join(" "),
			{ background: true }
		)
		await neutralino.app.killProcess()
	}
}

export async function downloadUpdateInfo(): Promise<UpdateInfo> {
	const res = await fetch(UPDATE_INFO_URL)
	if (!res.ok) throw new Error("Failed to download update info")
	return await res.json()
}

export function shouldUpdateTo(info: UpdateInfo): boolean {
	return !!info.version && info.version > desktopVersion
}
