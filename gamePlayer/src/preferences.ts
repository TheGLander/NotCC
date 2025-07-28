import { Getter, PrimitiveAtom, Setter, WritableAtom, atom } from "jotai"
import { atomEffect } from "jotai-effect"
import { writeJson } from "@/fs"
import { isDesktop } from "./helpers"

export const DEFAULT_VALUE = Symbol()

const preferenceAtoms: Record<
	string,
	[PrimitiveAtom<any>, PrimitiveAtom<any>]
> = {}

export function getTruePreferenceAtom<T>(
	atom: WritableAtom<any, [any], void>
): PrimitiveAtom<T | typeof DEFAULT_VALUE> | undefined {
	return Object.values(preferenceAtoms).find(
		newAtom => newAtom[1] === atom
	)?.[0]
}

export function preferenceAtom<T>(
	key: string,
	defaultValue: T
): PrimitiveAtom<T> {
	if (preferenceAtoms[key]) return preferenceAtoms[key][1]
	const prefAtom = atom<T | typeof DEFAULT_VALUE>(DEFAULT_VALUE)
	const defaultPrefAtom = atom(
		get => {
			const val = get(prefAtom)
			return val === DEFAULT_VALUE ? defaultValue : val
		},
		(_get, set, val: T | typeof DEFAULT_VALUE) => set(prefAtom, val)
	)
	preferenceAtoms[key] = [prefAtom, defaultPrefAtom]
	return defaultPrefAtom as PrimitiveAtom<T>
}

const dismissablePreferenceAtoms: PrimitiveAtom<boolean>[] = []

export function dismissablePreferenceAtom(key: string): PrimitiveAtom<boolean> {
	const atom = preferenceAtom<boolean>(key, false)
	dismissablePreferenceAtoms.push(atom)
	return atom
}

export function resetDissmissablePreferencesGs(_get: Getter, set: Setter) {
	for (const atom of dismissablePreferenceAtoms) {
		set(getTruePreferenceAtom(atom)!, DEFAULT_VALUE)
	}
}

export const allPreferencesAtom = atom(
	get =>
		Object.fromEntries(
			Object.entries(preferenceAtoms)
				.map<[string, any]>(([key, atom]) => [key, get(atom[0])])
				.filter(ent => ent[1] !== DEFAULT_VALUE)
		),
	(_get, set, allPrefs: Record<string, unknown>) => {
		for (const [key, prefAtom] of Object.entries(preferenceAtoms)) {
			set(prefAtom[0], key in allPrefs ? allPrefs[key] : DEFAULT_VALUE)
		}
	}
)

export const preloadFinishedAtom = atom(false)
export const syncAllowed_thisisstupid = { val: false }

export function isPreloading(get: Getter) {
	return !get(preloadFinishedAtom) || !syncAllowed_thisisstupid.val
}
export const preferenceWritingAtom = atomEffect((get, _set) => {
	void get(allPreferencesAtom)
	if (isPreloading(get)) return
	const prefs = get(allPreferencesAtom)
	writeJson("preferences.json", prefs)
})

export function localStorageAtom<T>(
	key: string,
	defaultValue: T
): PrimitiveAtom<T> {
	let atomValue
	try {
		const readValue = globalThis.localStorage && localStorage.getItem(key)
		if (readValue) {
			atomValue = JSON.parse(readValue)
			localStorage.setItem(key, atomValue)
		} else {
			atomValue = defaultValue
		}
	} catch {}

	return atom(atomValue, function (this: PrimitiveAtom<T>, _get, set, val) {
		globalThis.localStorage?.setItem(key, JSON.stringify(val))
		set(this, val)
	})
}

export const playEnabledAtom = localStorageAtom(
	"NotCC play enabled",
	// No downloads page on desktop!
	isDesktop()
)
