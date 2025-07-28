#!/usr/bin/env zx
import "zx/globals"

const version = JSON.parse(await fs.readFile("./package.json", "utf-8")).version
await fs.copyFile("./NotCC.zip", `./dist/notcc-desktop-v${version}.zip`)
