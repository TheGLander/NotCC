import { PrimitiveAtom, WritableAtom, atom } from "jotai"
import { atomEffect } from "jotai-effect"
import { writeFile } from "@/fs"

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

export function preferenceAtom<T>(key: string, defaultValue: T) {
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
	return defaultPrefAtom
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

function writePrefs(prefs: any) {
	return writeFile(
		"preferences.json",
		new TextEncoder().encode(JSON.stringify(prefs)).buffer
	)
}

export const allowWritingPreferencesAtom = atom(false)

export const preferenceWritingAtom = atomEffect((get, _set) => {
	if (!get(allowWritingPreferencesAtom)) return
	const prefs = get(allPreferencesAtom)
	writePrefs(prefs)
})
