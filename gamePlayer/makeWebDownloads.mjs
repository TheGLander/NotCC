#!/usr/bin/env zx
import "zx/globals"

const version = JSON.parse(await fs.readFile("./package.json", "utf-8")).version
await fs.copyFile("./NotCC.zip", `./dist/notcc-desktop-v${version}.zip`)
await fs.copyFile(
	"./neuDist/notcc-player/resources.neu",
	`./dist/desktop-resources.neu`
)
const desktopUpdateData = {
	version: parseInt(process.env.VITE_DESKTOP_VERSION),
	versionName: version,
	resourcesUrl: `https://glander.club/notcc/prewrite/desktop-resources.neu`,
}
await fs.writeJSON("./dist/desktop-update.json", desktopUpdateData)
