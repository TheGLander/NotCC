import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { atomEffect } from "jotai-effect"
import { useEffect, useState } from "preact/hooks"
import { SetSelectorPage } from "./pages/SetSelectorPage"
import { FunctionComponent } from "preact"
import { Preloader } from "./components/Preloader"
import { LevelPlayerPage } from "./pages/LevelPlayerPage"
import { levelAtom, levelSetAtom, resolveHashLevel } from "./levelData"
import { EffectFn, ignorantAtomEffectHook } from "./helpers"
import { preferenceWritingAtom } from "./preferences"

function searchParamsToObj(query: string): SearchParams {
	return Object.fromEntries(new URLSearchParams(query))
}

type SearchParams = { [P in string]?: string }

interface HashLocation {
	pagePath: string[]
	searchParams: SearchParams
}

function parseHashLocation(): HashLocation {
	const notccLocation = new URL("http://fake.notcc.path")
	try {
		notccLocation.href = `http://fake.notcc.path/${location.hash.slice(1)}`
	} catch {}

	let pagePath = notccLocation.pathname.split("/").slice(2)
	const searchParams = {
		...searchParamsToObj(notccLocation.search),
		...searchParamsToObj(location.search),
	}
	if (location.search !== "") {
		const newLoc = new URL(location.toString())
		newLoc.search = ""
		history.replaceState(null, "", newLoc)
	}
	return { pagePath, searchParams }
}

function applyHashLocation(hashLoc: HashLocation): void {
	const newLoc = new URL(location.toString())
	if (
		hashLoc.pagePath.length === 0 &&
		Object.keys(hashLoc.searchParams).length === 0
	) {
		newLoc.hash = ""
	} else {
		newLoc.hash = `#/${hashLoc.pagePath.join("/")}${
			Object.keys(hashLoc.searchParams).length === 0
				? ""
				: // Bad TS types
				  `?${new URLSearchParams(
						hashLoc.searchParams as Record<string, string>
				  )}`
		}`
	}

	history.pushState(null, "", newLoc)
}
interface Page {
	component: FunctionComponent
	requiresLevel?: boolean
	isLevelPlayer?: boolean
}

const pages: Partial<Record<string, Page>> = {
	"": { component: SetSelectorPage },
	play: {
		component: LevelPlayerPage,
		requiresLevel: true,
		isLevelPlayer: true,
	},
}

export const CUSTOM_LEVEL_SET_IDENT = "*custom-level"
export const CUSTOM_SET_SET_IDENT = "*custom-level"

export const pageNameAtom = atom<string>("")
export const levelNAtom = atom<number | null>(null)
export const levelSetIdentAtom = atom<string | null>(null)
export const searchParamsAtom = atom<SearchParams>({})

export const pageAtom = atom<Page | null, [pageName: string], void>(
	get => pages[get(pageNameAtom)] ?? null,
	(_get, set, pageName) => set(pageNameAtom, pageName)
)
export const preventImmediateHashUpdateAtom = atom(false)

const useHashToInternalLocationSync = ignorantAtomEffectHook((get, set) => {
	const listener = () => {
		const hashLoc = parseHashLocation()

		const pageName = hashLoc.pagePath[0] ?? ""
		set(pageNameAtom, pageName)

		const page = pages[pageName]
		set(searchParamsAtom, hashLoc.searchParams)
		if (page?.requiresLevel) {
			set(levelSetIdentAtom, hashLoc.pagePath[1])
			set(levelNAtom, parseInt(hashLoc.pagePath[2]))
		} else {
			set(levelSetIdentAtom, null)
			set(levelNAtom, null)
		}

		set(preventImmediateHashUpdateAtom, true)
		resolveHashLevel(get, set)
	}
	listener()
	window.addEventListener("hashchange", listener)
	return () => window.removeEventListener("hashchange", listener)
})

const internalToHashLocationSyncAtom = atomEffect((get, set) => {
	discardUselessLevelData(get, set)
	const levelN = get(levelNAtom)
	const levelSetIdent = get(levelSetIdentAtom)
	const pageName = get(pageNameAtom)
	const searchParams = get(searchParamsAtom)

	if (get(preventImmediateHashUpdateAtom)) {
		set(preventImmediateHashUpdateAtom, false)
		return
	}

	applyHashLocation({
		pagePath: [
			pageName === "" ? null : pageName,
			levelSetIdent,
			levelN !== null ? levelN.toString() : null,
		].filter((part): part is string => part !== null),
		searchParams,
	})
})

const discardUselessLevelData: EffectFn = (get, set) => {
	const page = get(pageAtom)
	if (!page?.isLevelPlayer) {
		set(levelSetIdentAtom, null)
		set(levelNAtom, null)
		set(levelAtom, null)
		set(levelSetAtom, null)
		const searchParams = get(searchParamsAtom)
		delete searchParams.level
		set(searchParamsAtom, searchParams)
	}
}

function PageNotFound(props: { pageName: string }) {
	return <div class="box m-auto">Page "{props.pageName}" doesn't exist.</div>
}

export function Router() {
	const [preloadComplete, setPreloadComplete] = useState(false)
	const pageName = useAtomValue(pageNameAtom)
	const setPreventImmediateHashUpdate = useSetAtom(
		preventImmediateHashUpdateAtom
	)
	useEffect(() => {
		// Prevent internalToHashLocationSyncAtom from writing to the hash on mount
		setPreventImmediateHashUpdate(true)
	}, [])
	useHashToInternalLocationSync()
	useAtom(internalToHashLocationSyncAtom)
	useAtom(preferenceWritingAtom)
	if (!preloadComplete)
		return <Preloader preloadComplete={() => setPreloadComplete(true)} />

	const page = pages[pageName]
	if (page === undefined) return <PageNotFound pageName={pageName} />
	const Page = page.component
	return <Page />
}
