import { Getter, Setter, atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "preact/hooks"
import { SetSelectorPage } from "./pages/SetSelectorPage"
import { FunctionComponent } from "preact"
import { Preloader } from "./components/Preloader"
import { LevelPlayerPage } from "./pages/LevelPlayerPage"
import {
	levelAtom,
	levelSetAtom,
	levelSetAutosaveAtom,
	resolveHashLevelGs,
} from "./levelData"
import { EffectFn, ignorantAtomEffectHook } from "./helpers"
import { preferenceWritingAtom } from "./preferences"
import { atomEffect } from "jotai-effect"
import { ExaPlayerPage } from "./pages/ExaPlayerPage"
import { tilesetSyncAtom } from "./components/PreferencesPrompt/TilesetsPrompt"
import { levelControlsAtom } from "./components/Sidebar"
import { sfxSyncAtom } from "./components/PreferencesPrompt/SfxPrompt"
import { setRRRoutesAtomWrapped } from "./railroad"

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
	const hashLoc: HashLocation = { pagePath, searchParams }
	if (location.search !== "") {
		const newLoc = new URL(location.href)
		newLoc.search = ""
		newLoc.hash = makeHashFromLoc(hashLoc)
		history.replaceState(null, "", newLoc)
	}
	return hashLoc
}

function makeHashFromLoc(hashLoc: HashLocation): string {
	if (
		hashLoc.pagePath.length === 0 &&
		Object.keys(hashLoc.searchParams).length === 0
	) {
		return ""
	}
	return `#/${hashLoc.pagePath.join("/")}${
		Object.keys(hashLoc.searchParams).length === 0
			? ""
			: // Bad TS types
				`?${new URLSearchParams(
					hashLoc.searchParams as Record<string, string>
				)}`
	}`
}

function applyHashLocation(hashLoc: HashLocation): void {
	const newLoc = new URL(location.href)
	newLoc.hash = makeHashFromLoc(hashLoc)
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
	exa: {
		component: ExaPlayerPage,
		requiresLevel: true,
		isLevelPlayer: true,
	},
}

export const CUSTOM_LEVEL_SET_IDENT = "*custom-level"
export const CUSTOM_SET_SET_IDENT = "*custom-set"

export const nullablePageNameAtom = atom<string | null>(null)
export const pageNameAtom = atom(
	get => get(nullablePageNameAtom) ?? "",
	(_get, set, val: string) => set(nullablePageNameAtom, val)
)
export const levelNAtom = atom<number | null>(null)
export const levelSetIdentAtom = atom<string | null>(null)
export const searchParamsAtom = atom<SearchParams>({})

export const pageAtom = atom<Page | null, [pageName: string], void>(
	get => pages[get(pageNameAtom)] ?? null,
	(_get, set, pageName) => set(pageNameAtom, pageName)
)
export const preventImmediateHashUpdateAtom = atom(false)

export function updateVariablesFromHashGs(get: Getter, set: Setter) {
	const hashLoc = parseHashLocation()

	const pageName = hashLoc.pagePath[0]
	set(
		nullablePageNameAtom,
		pageName === "" || pageName === undefined ? null : pageName
	)

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
	resolveHashLevelGs(get, set)
}

const hashToInternalLocationSyncEffect: EffectFn = (get, set) => {
	const listener = () => {
		updateVariablesFromHashGs(get, set)
	}
	window.addEventListener("hashchange", listener)
	return () => window.removeEventListener("hashchange", listener)
}

const internalToHashLocationSyncEffect: EffectFn = (get, set) => {
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
}

const discardUselessLevelDataEffect: EffectFn = (get, set) => {
	const nullablePageName = get(nullablePageNameAtom)
	const page = get(pageAtom)
	if (nullablePageName !== null && !page?.isLevelPlayer) {
		set(levelSetIdentAtom, null)
		set(levelNAtom, null)
		set(levelAtom, null)
		set(levelSetAtom, null)
		set(setRRRoutesAtomWrapped, null)
		set(levelControlsAtom, {})
		const searchParams = get(searchParamsAtom)
		delete searchParams.level
		set(searchParamsAtom, searchParams)
	}
}

function PageNotFound(props: { pageName: string }) {
	return <div class="box m-auto">Page "{props.pageName}" doesn't exist.</div>
}

export const embedModeAtom = atom(get => !!get(searchParamsAtom).embed)
export const embedReadyAtom = atom(false)

const routerEffectAtom = atomEffect((get, set) => {
	discardUselessLevelDataEffect(get, set)
	internalToHashLocationSyncEffect(get, set)
})

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
	ignorantAtomEffectHook(hashToInternalLocationSyncEffect)()
	useAtom(routerEffectAtom)
	useAtom(preferenceWritingAtom)
	useAtom(levelSetAutosaveAtom)
	useAtom(tilesetSyncAtom)
	useAtom(sfxSyncAtom)
	if (!preloadComplete)
		return <Preloader preloadComplete={() => setPreloadComplete(true)} />

	const page = pages[pageName]
	if (page === undefined) return <PageNotFound pageName={pageName} />
	const Page = page.component
	return <Page />
}
