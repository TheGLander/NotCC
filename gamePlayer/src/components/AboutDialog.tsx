import { PromptComponent } from "@/prompts"
import { Dialog } from "./Dialog"

export const AboutPrompt: PromptComponent<void> = props => {
	return (
		<Dialog
			header="About NotCC"
			section={
				<div class="mx-2 break-words">
					<h2 class="text-2xl">NotCC</h2>
					<p>
						NotCC is an accurate,{" "}
						<a href="https://github.com/TheGLander/NotCC" target="_blank">
							open-source
						</a>{" "}
						<a
							href="https://store.steampowered.com/app/348300/Chips_Challenge_2/"
							target="_blank"
						>
							Chip's Challenge 2
						</a>{" "}
						and{" "}
						<a
							href="https://store.steampowered.com/app/346850/Chips_Challenge_1/"
							target="_blank"
						>
							Chip's Challenge 1 (Steam)
						</a>{" "}
						emulator.
					</p>
					<p>
						<br />
						NotCC is primarily made by{" "}
						<a href="https://glander.club" target="_blank">
							G lander
						</a>
						.
					</p>
					<p>Thanks to:</p>
					<ul role="list" class="list-disc pl-8">
						<li>
							The Chip's Challenge community, residing at{" "}
							<a target="_blank" href="https://bitbusters.club">
								the Bit Busters Club
							</a>
							. Also, more specifically:
						</li>
						<li>
							<a target="_blank" href="https://eev.ee/">
								eevee
							</a>
							, for creating the first CC2 emulator,{" "}
							<a target="_blank" href="https://c.eev.ee/lexys-labyrinth/">
								Lexy's Labyrinth
							</a>
							, which NotCC heavily borrowed (and still borrows) from.
						</li>
						<li>
							Markus O.,{" "}
							<a target="_blank" href="https://github.com/Bacorn42">
								Bacorn
							</a>
							, and{" "}
							<a target="_blank" href="https://github.com/SicklySilverMoon">
								Sickly
							</a>
							, for creating and maintaining SuperCC, the optimization tool
							ExaCC is heavily inspired by.
						</li>
						<li>
							<a target="_blank" href="https://github.com/zrax">
								Zrax
							</a>
							, for creating a very helpful suite of CC tools, appropriately
							called{" "}
							<a target="_blank" href="http://cctools.zrax.net">
								CCTools
							</a>
							.
						</li>
						<li>
							Anders Kaseorg and Kawaiiprincess, for creating and porting to CC2
							(respectively) the bundled Tile World tileset.
						</li>
						<li>
							<a
								target="_blank"
								href="https://wiki.bitbusters.club/User:Sharpeye468"
							>
								Sharpeye
							</a>
							, for finding a bug with ExaCC auto-scaling and being one of the
							first people to use ExaCC for optimization.
						</li>
						<li>
							<a target="_blank" href="https://tylersontag.com">
								Tyler Sontag
							</a>
							, for creating the very, <i>very</i> helpful resident Discord bot,{" "}
							<a target="_blank" href="https://bitbusters.club/gliderbot">
								Gliderbot
							</a>
							.
						</li>
						<li>
							<a
								target="_blank"
								href="https://www.blogger.com/profile/14488214217998239760"
							>
								IHNN
							</a>
							, for providing details and feedback on non-legal glitches and
							their prevention.
						</li>
					</ul>
					<p class="text-sm">
						Last change: {import.meta.env.VITE_LAST_COMMIT_INFO}.
						<br />
						Built at {import.meta.env.VITE_BUILD_TIME}.
					</p>
				</div>
			}
			buttons={[["Ok", () => {}]]}
			onResolve={props.onResolve}
		/>
	)
}
