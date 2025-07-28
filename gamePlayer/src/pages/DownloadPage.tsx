import { useSetAtom } from "jotai"
import { Header } from "./SetSelectorPage"
import { playEnabledAtom } from "@/preferences"
import { isSSG } from "@/helpers"

export function DownloadPage() {
	const setPlayEnabled = useSetAtom(playEnabledAtom)
	return (
		<div class="flex flex-col items-center gap-2">
			<Header />
			<div class="box w-full lg:w-3/5">
				<p>
					<b>NotCC</b> is an{" "}
					<a href="https://github.com/TheGLander/NotCC" target="_blank"></a>
					open-source and scoreboard-legal Chip's Challenge® 2 emulator. It's
					very cool. Screenshots and more copywriting to come.
				</p>
				<p>
					<i>
						Chip's Challenge is a registered trademark of Bridgestone Multimedia
						Group LLC. NotCC is not affiliated with, endorsed or sponsored by
						Bridgestone Multimedia Group LLC.
					</i>
				</p>
			</div>{" "}
			<div class="flex w-full gap-2 lg:w-2/3">
				<div class="box flex flex-1 flex-col gap-1">
					<span>
						Download NotCC to play it on Linux, macOS, or Windows computer!
					</span>
					<a
						href={`./notcc-desktop-v${import.meta.env.VITE_VERSION}.zip`}
						download
						class="no-underline"
					>
						<button class="block w-full text-3xl">Download</button>
					</a>
					<p>
						Since NotCC is a Progressive Web App, you can also install NotCC on
						your phone by{" "}
						<a
							href="https://web.archive.org/web/20241231023706/https://help.antisoftware.club/support/solutions/articles/62000227811-how-to-install-the-cohost-app"
							target="_blank"
						>
							following these instructions
						</a>
						.
					</p>
				</div>
				<div class="box flex flex-1 flex-col gap-1">
					<span>
						You can also play NotCC right here on this website, on desktop or
						mobile!
					</span>
					<button
						onClick={() => setPlayEnabled(true)}
						class="text-3xl"
						disabled
						ref={ref => {
							// React doesn't like changing properites on hydration, so if we want to have the button
							// to be disabled during SSG and enabled otherwise, we can't just set `disabled` to the correct value
							if (ref) {
								ref.disabled = isSSG()
							}
						}}
					>
						Play online
					</button>
					<span>
						If you open a set or level in the web version, you can copy the link
						to share the level or set!
					</span>
				</div>
			</div>
		</div>
	)
}
