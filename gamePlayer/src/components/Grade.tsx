import { ComponentChild, ComponentChildren } from "preact"
import { Expl } from "./Expl"
import { ReportGrade } from "@/scoresApi"

function Bi(props: { children?: ComponentChildren }) {
	return (
		<strong>
			<em>{props.children}</em>
		</strong>
	)
}
function Sm(props: { children?: ComponentChildren }) {
	return <span class="text-sm">{props.children}</span>
}

const gradeMap: Record<ReportGrade, [ComponentChild, ComponentChild]> = {
	"better than bold": [
		<Bi>B+</Bi>,
		<Bi>
			B<Sm>old</Sm>+
		</Bi>,
	],
	"bold confirm": [
		<Bi>BC</Bi>,
		<Bi>
			B<Sm>old</Sm>C<Sm>onf</Sm>
		</Bi>,
	],
	"partial confirm": [
		<Bi>PC</Bi>,
		<Bi>
			P<Sm>art</Sm>C<Sm>onf</Sm>
		</Bi>,
	],
	bold: [
		<strong>B</strong>,
		<strong>
			B<Sm>old</Sm>
		</strong>,
	],
	"better than public": [
		"P+",
		<>
			P<Sm>ublic</Sm>+
		</>,
	],
	public: [
		"P",
		<>
			P<Sm>ublic</Sm>
		</>,
	],
	solved: [
		"S",
		<>
			S<Sm>olved</Sm>
		</>,
	],
	unsolved: [
		"U",
		<>
			U<Sm>nsolved</Sm>
		</>,
	],
}

export function ExplGrade() {
	return (
		<Expl title="Score grade" mode="dialog">
			<div class="grid gap-2 [grid-template-columns:repeat(2,auto);]">
				<div>Grade</div>
				<div>Meaning</div>
				<Grade grade="better than bold" />
				<div>
					Better than bold. You've achieved a higher score than what is on the
					scoreboards! Report it and be part of Chips history!
				</div>
				<Grade grade="bold confirm" />
				<div>
					Bold Confirm. You're the second person to achieve this score, thus{" "}
					<i>confirming</i> the <i>unconfirmed</i> score.
				</div>
				<Grade grade="partial confirm" />
				<div>
					Partial Confirm. You've achieved a score higher than the highest
					confirmed score, but lower than the unconfirmed score, thus confirming
					that the unconfirmed score is at least <i>partially</i> real.
				</div>
				<Grade grade="bold" />
				<div>Bold. Same as highest known/reported score for this level.</div>
				<Grade grade="better than public" />
				<div>
					Better than public. This score is better than the score of the public
					route, but is less than bold.
				</div>
				<Grade grade="public" />
				<div>Public. This score matches the public route score.</div>
				<Grade grade="solved" />
				<div>Solved. This score is worse than the public route score.</div>
				<Grade grade="unsolved" />
				<div>Unsolved. This level has not been solved yet.</div>
			</div>
		</Expl>
	)
}

export function Grade(props: { grade: ReportGrade; short?: boolean }) {
	return (
		<span class="text-lg">{gradeMap[props.grade][props.short ? 0 : 1]}</span>
	)
}
