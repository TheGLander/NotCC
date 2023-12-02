import { atom, useAtom } from "jotai"

const altLogoAtom = atom(false)

function Header() {
	const [altLogo, setAltLogo] = useAtom(altLogoAtom)
	return (
		<div class="box max-w-4/5 mx-auto my-4 flex w-fit flex-row items-center max-sm:max-w-sm max-sm:flex-wrap">
			<img
				class="inline-block aspect-square max-sm:ml-auto max-sm:h-10"
				src={altLogo ? "/iconBigAlt.png" : "/iconBig.png"}
				onClick={() => setAltLogo(val => !val)}
				draggable={false}
			/>
			<div class="mx-2 flex flex-col max-sm:contents">
				<h1 class="inline text-5xl max-sm:ml-2 max-sm:mr-auto sm:text-9xl">
					NotCC
				</h1>
				<p class="self-center text-sm max-sm:mx-auto sm:text-[1.05rem]">
					A scoreboard-legal Chip's Challenge 2® emulator.
				</p>
			</div>
		</div>
	)
}

export function SetSelectorPage() {
	return (
		<div class="flex flex-1 flex-col items-center overflow-y-auto">
			<Header />
			<div class="box m-auto h-fit w-fit text-xl">
				<button>Todo!</button>
			</div>
		</div>
	)
}
