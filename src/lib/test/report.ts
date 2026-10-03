/**
 * Turning what the tester answered, and what the app measured for itself, into
 * the text that gets sent in. Plain functions, no DOM and no network, so the
 * wording can be tested.
 */
import type { Question, Step } from './protocol';

/** One line the app read off the running camera, rather than asking for. */
export interface Reading {
	label: string;
	value: string;
}

export interface Report {
	/** Free text the tester typed, and the options they picked, by question name. */
	answers: Record<string, string>;
	/** Measurements taken by the app, in the order they were taken. */
	readings: Reading[];
}

/**
 * A required question with no answer is a gap in the run. An optional one left
 * empty is an answer: the tester had nothing to add. The two read differently
 * so that whoever goes through the results can tell them apart.
 */
const MISSING = '(not answered)';
const LEFT_BLANK = '(left blank)';

/**
 * The app's readings in protocol order, one set per step. Going back to a step
 * and through it again measures it again; the newer set has replaced the older
 * one by then, so the report never lists the same measurement twice.
 */
export function readingsInOrder(steps: Step[], byStep: Record<string, Reading[]>): Reading[] {
	return steps.flatMap((step) => byStep[step.id] ?? []);
}

/** Every question in the step, answered or not, as `label: answer` lines. */
export function stepLines(step: Step, answers: Record<string, string>): string[] {
	return [...(step.beforeWait ?? []), ...step.questions].map((q) => {
		const answer = answers[q.name]?.trim() || (q.optional ? LEFT_BLANK : MISSING);
		return `  ${q.label}: ${answer}`;
	});
}

/**
 * The questions that must be answered and have not been. Takes anything with a
 * question list: a step, or the part of one asked before its countdown.
 */
export function unanswered(
	from: { questions: Question[] },
	answers: Record<string, string>
): string[] {
	return from.questions.filter((q) => !q.optional && !answers[q.name]?.trim()).map((q) => q.name);
}

/**
 * The whole run as readable text. This is what lands in the Netlify inbox and
 * what the tester sees on the last screen, so it is the same thing twice and
 * cannot disagree with itself.
 */
export function formatReport(steps: Step[], report: Report): string {
	const out: string[] = [];

	for (const step of steps) {
		if (step.questions.length === 0) continue;
		out.push(step.title, ...stepLines(step, report.answers), '');
	}

	if (report.readings.length > 0) {
		out.push('Measured by the app');
		for (const r of report.readings) out.push(`  ${r.label}: ${r.value}`);
		out.push('');
	}

	return out.join('\n').trimEnd();
}

/**
 * The body Netlify expects: url-encoded, with `form-name` naming the form
 * declared in `static/__forms.html`. Netlify keeps only the fields that form
 * declares, so there are four, and they never change with the questions:
 * the phone, for telling submissions apart in Netlify's list; `summary`, for
 * reading one run; and `data`, the same run as JSON, for comparing many.
 */
export function submissionBody(
	formName: string,
	phone: string,
	summary: string,
	data: string
): string {
	const body = new URLSearchParams();
	body.set('form-name', formName);
	body.set('phone', phone.trim() || 'not given');
	body.set('summary', summary);
	body.set('data', data);
	return body.toString();
}
