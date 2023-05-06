#!/usr/bin/env zx

import "zx/globals"

const setsDirectory = argv["sets-dir"]
const setsToTest = typeof argv.set === "string" ? [argv.set] : argv.set

if (!setsDirectory) {
	console.error(chalk.red`Specify a sets directory with --sets-dir!`)
	process.exit(1)
}

if (!setsToTest) {
	console.error(chalk.red`Specify sets to test with --set <set_name>!`)
	process.exit(1)
}

async function downloadSet(setName) {
	await $`wget -r -nH --cut-dirs=3 -P ${setsDirectory} --no-parent --reject="index.html*" "https://bitbusters.club/gliderbot/sets/cc2/${setName}/"`
}

await fs.mkdirp(setsDirectory)

let failed = false

for (const setName of setsToTest) {
	const setPath = path.join(setsDirectory, setName)
	const setExists = await fs.exists(setPath)
	echo(`Testing ${setName}`)
	if (!setExists) {
		echo(chalk.yellow(`Looks like "${setName}" isn't cached, downloading...`))
		await downloadSet(setName)
	}
	const verifyProcess = $`pnpm notcc verify ${setPath} --ci`
	await verifyProcess.nothrow()
	if (verifyProcess.exitCode !== 0) {
		failed = true
	}
}

if (failed) {
	process.exit(1)
}