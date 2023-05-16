#!/usr/bin/env zx
/* eslint-disable no-undef */

import "zx/globals"

const distributionName = "notcc-player"

const binariesDir = path.join("dist", distributionName)
const resourcesNeuPath = path.join(binariesDir, "resources.neu")
const macBinPath = path.join("NotCC.app", "Contents", "MacOS")

$.verbose = false

console.log("Building base packages")

await $`pnpm neu update`
await $`pnpm neu build`

if (!(await fs.exists(binariesDir))) {
	console.error("Failed to build binaries")
	process.exit(2)
}

console.log("Making Mac package")

await fs.copy(
	path.join(binariesDir, `${distributionName}-mac_x64`),
	path.join(macBinPath, distributionName)
)
await fs.chmod(path.join(macBinPath, distributionName), 0o755)
await fs.copy(resourcesNeuPath, path.join(macBinPath, "resources.neu"))

console.log("Making artifacts directory")

await fs.remove("artifacts")
await fs.mkdirp("artifacts")

const toCopyBinaries = [
	[`${distributionName}-linux_x64`, `${distributionName}-linux`],
	[`${distributionName}-win_x64.exe`, `${distributionName}-windows.exe`],
	["resources.neu", "resources.neu"],
	["WebView2Loader.dll", "WebView2Loader.dll"],
]

for (const [src, dest] of toCopyBinaries) {
	await fs.copy(path.join(binariesDir, src), path.join("artifacts", dest))
}

await fs.chmod(path.join("artifacts", `${distributionName}-linux`), 0o755)

await fs.copy("NotCC.app", path.join("artifacts", "NotCC.app"))
