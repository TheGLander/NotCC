#!/usr/bin/env zx

import "zx/globals"

const setsDirectory = argv["sets-dir"]
const syncDirectory = argv["sync-dir"]
const setsToTest = typeof argv.set === "string" ? [argv.set] : argv.set

if (!setsDirectory) {
	console.error(chalk.red`Specify a sets directory with --sets-dir!`)
	process.exit(1)
}

if (!setsToTest) {
	console.error(chalk.red`Specify sets to test with --set <set_name>!`)
	process.exit(1)
}

if (!syncDirectory) {
	console.error(chalk.red`Specify a directory with syncfiles with --sync-dir!`)
	process.exit(1)
}

const defaultSyncPath = path.join(syncDirectory, "default.sync")

if (!(await fs.exists(defaultSyncPath))) {
	console.error(
		chalk.red`The syncfile directory must contain a default.sync file!`
	)
	process.exit(1)
}

let setListing = null
let tempDir = null

async function downloadSet(setName) {
	if (!setListing) {
		const res = await fetch("https://api.bitbusters.club/custom-packs/cc2")
		if (!res.ok) throw new Error("Failed to contact bb.club")
		setListing = await res.json()
		tempDir = path.join(os.tmpdir(), await fs.mkdtemp("notcc-test"))
		await fs.mkdir(tempDir)
		process.on("exit", async () => {
			fs.rmdirSync(tempDir, { recursive: true })
		})
	}
	const set = setListing.find(set => set.pack_name === setName)
	if (!set) throw new Error("Set is not on bb.club")
	const res = await fetch(set.download_url)
	if (!res.ok) throw new Error("Failed to contact bb.club")
	const setZipPath = path.join(tempDir, `${setName}.zip`)
	const setPath = path.join(setsDirectory, setName)
	await fs.promises.writeFile(setZipPath, res.body)
	await fs.mkdirp(setPath)
	await $`cd ${setPath} && unzip ${setZipPath}`
	await fs.rm(setZipPath)
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
	const syncPath = path.join(syncDirectory, `${setName}.sync`)
	const syncExists = await fs.exists(syncPath)
	const verifyProcess = $`pnpm cli ${setPath} -s ${
		syncExists ? syncPath : defaultSyncPath
	}`
	await verifyProcess.nothrow()
	if ((await verifyProcess.exitCode) !== 0) {
		failed = true
	}
}

process.exitCode = failed ? 1 : 0
