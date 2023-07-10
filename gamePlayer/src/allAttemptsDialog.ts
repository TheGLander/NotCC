import { metricsFromAttempt, protoTimeToMs } from "@notcc/logic"
import { protobuf } from "@notcc/logic"
import { Pager } from "./pager"
import { instanciateTemplate } from "./utils"

const allAttemptsDialog =
	document.querySelector<HTMLDialogElement>("#allAttemptsDialog")!
// const verifyAllButton =
// 	allAttemptsDialog.querySelector<HTMLButtonElement>("#verifyAllButton")!
const successulTemplate = allAttemptsDialog.querySelector<HTMLTemplateElement>(
	"#successfulAttemptTemplate"
)!
const failedTemplate = allAttemptsDialog.querySelector<HTMLTemplateElement>(
	"#failedAttemptTemplate"
)!

function glitchToString(glitch: protobuf.IGlitchInfo): string {
	return `${
		protobuf.GlitchInfo.KnownGlitches[glitch.glitchKind!]
	} (${glitch.location!.x!}, ${glitch.location!.y!}) at ${Math.ceil(
		protoTimeToMs(glitch.happensAt!) / 1000
	)}s`
}

export function openAllAttemptsDialog(pager: Pager): void {
	const set = pager.loadedSet
	if (set === null) return
	const attempts = set.seenLevels[set.currentLevel].levelInfo.attempts ?? []
	const root = allAttemptsDialog.querySelector<HTMLDivElement>("section")!
	// Nuke all current data
	root.textContent = ""
	for (const attempt of attempts) {
		const isSuccessful = !!attempt.solution
		const attEl = instanciateTemplate<HTMLDivElement>(
			isSuccessful ? successulTemplate : failedTemplate
		)
		const startTimeEl = attEl.querySelector(".startTime"),
			endTimeEl = attEl.querySelector(".endTime"),
			metricsEl = attEl.querySelector(".metrics"),
			failReasonEl = attEl.querySelector(".failReason"),
			expandTriangleEl = attEl.querySelector(".expandTriangle"),
			replayButton = attEl.querySelector<HTMLButtonElement>(".replayButton"),
			extraInfoEl = attEl.querySelector(".extraInfo"),
			realTimeEl = attEl.querySelector(".realTime"),
			glitchListEl = attEl.querySelector<HTMLUListElement>(".glitchList")

		if (startTimeEl && attempt.attemptStart) {
			const startTime = new Date(protoTimeToMs(attempt.attemptStart))
			startTimeEl.textContent = startTime.toLocaleString() || "???"
		}
		if (endTimeEl && attempt.attemptStart && attempt.attemptLength) {
			const endTime = new Date(
				protoTimeToMs(attempt.attemptStart) +
					protoTimeToMs(attempt.attemptLength)
			)
			endTimeEl.textContent = endTime.toLocaleString() || "???"
		}
		if (metricsEl && attempt.solution?.outcome) {
			const metrics = metricsFromAttempt(
				set.currentLevel,
				attempt.solution?.outcome
			)
			metricsEl.textContent = `${Math.ceil(metrics.timeLeft)}s / ${
				metrics.points
			}pts`
			if (realTimeEl) {
				realTimeEl.textContent = metrics.realTime.toFixed(2)
			}
		}
		if (expandTriangleEl && extraInfoEl) {
			attEl.addEventListener("click", () => {
				const showExtra = expandTriangleEl.classList.toggle("open")
				extraInfoEl.classList.toggle("showExtra", showExtra)
			})
		}
		if (replayButton) {
			if (attempt.solution) {
				replayButton.addEventListener("click", ev => {
					ev.preventDefault()
					ev.stopPropagation()
					pager.loadSolution(attempt.solution!)
					allAttemptsDialog.close()
				})
			} else {
				replayButton.disabled = true
			}
		}
		if (failReasonEl && attempt.failReason) {
			failReasonEl.textContent = attempt.failReason
		}
		if (glitchListEl && attempt.solution?.usedGlitches) {
			for (const glitch of attempt.solution.usedGlitches) {
				const li = document.createElement("li")
				li.textContent = glitchToString(glitch)
				glitchListEl.appendChild(li)
			}
		}

		attEl.tabIndex = 0
		root.appendChild(attEl)
	}
	allAttemptsDialog.showModal()
}
