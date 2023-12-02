import { atom, useAtom, useAtomValue } from "jotai"
import { atomEffect } from "jotai-effect"
import { useEffect, useState } from "preact/hooks"
import { SetSelectorPage } from "./pages/SetSelectorPage"
import { FunctionComponent } from "preact"
import { Preloader } from "./components/Preloader"
import { LevelPlayerPage } from "./pages/LevelPlayerPage"

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

export const pageNameAtom = atom<string>("")
export const levelNAtom = atom<number | null>(null)
export const levelSetIdentAtom = atom<string | null>(null)
export const searchParamsAtom = atom<SearchParams>({})

// A small hack to prevent internalToHashLocationSyncAtom from writing to the hash
// right after reading from it.
let preventImmediateHashUpdate = false

const hashToInternalLocationSyncAtom = atomEffect((_get, set) => {
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
		preventImmediateHashUpdate = true
	}
	listener()
	window.addEventListener("hashchange", listener)
	return () => window.removeEventListener("hashchange", listener)
})

const internalToHashLocationSyncAtom = atomEffect(get => {
	if (preventImmediateHashUpdate) {
		preventImmediateHashUpdate = false
		return
	}
	const levelN = get(levelNAtom)
	const levelSetIdent = get(levelSetIdentAtom)
	const pageName = get(pageNameAtom)

	applyHashLocation({
		pagePath: [
			pageName === "" ? null : pageName,
			levelSetIdent,
			levelN !== null ? levelN.toString() : null,
		].filter((part): part is string => part !== null),
		searchParams: get(searchParamsAtom),
	})
})

function PageNotFound(props: { pageName: string }) {
	return <div class="box m-auto">Page "{props.pageName}" doesn't exist.</div>
}

export function Router() {
	const [preloadComplete, setPreloadComplete] = useState(false)
	const pageName = useAtomValue(pageNameAtom)
	useEffect(() => {
		// Prevent internalToHashLocationSyncAtom from writing to the hash on mount
		preventImmediateHashUpdate = true
	}, [])
	useAtom(hashToInternalLocationSyncAtom)
	useAtom(internalToHashLocationSyncAtom)
	if (!preloadComplete)
		return <Preloader preloadComplete={() => setPreloadComplete(true)} />
	const Page = pages[pageName]?.component
	if (Page === undefined) return <PageNotFound pageName={pageName} />
	return <Page />
}
