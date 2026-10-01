/**
 * Turning what the tester answered, and what the app measured for itself, into
 * the text that gets sent in. Plain functions, no DOM and no network, so the
 * wording can be tested.
 */
import type { Step } from './protocol';

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
	/** Things that went wrong during the run and are worth sending anyway. */
	problems: string[];
}

const PLACEHOLDER = '(not answered)';

/** Every question in the step, answered or not, as `label: answer` lines. */
export function stepLines(step: Step, answers: Record<string, string>): string[] {
	return step.questions.map((q) => `  ${q.label}: ${answers[q.name]?.trim() || PLACEHOLDER}`);
}

/** The questions in this step that have no answer yet. */
export function unanswered(step: Step, answers: Record<string, string>): string[] {
	return step.questions.filter((q) => !answers[q.name]?.trim()).map((q) => q.name);
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

	if (report.problems.length > 0) {
		out.push('Problems during the run');
		for (const p of report.problems) out.push(`  ${p}`);
		out.push('');
	}

	return out.join('\n').trimEnd();
}

/**
 * The body Netlify expects: url-encoded, with `form-name` naming the form
 * declared in `static/__forms.html`. Three fields only — a field this does not
 * send is a field Netlify silently drops, and one block of text cannot drift
 * out of step with the questions the way twenty named fields would.
 */
export function submissionBody(formName: string, phone: string, summary: string): string {
	const body = new URLSearchParams();
	body.set('form-name', formName);
	body.set('phone', phone.trim() || 'not given');
	body.set('summary', summary);
	return body.toString();
}
