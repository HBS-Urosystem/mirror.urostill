/**
 * The guided test: what the tester is asked, in what order, and what the app
 * sets up for them before each question.
 *
 * Plain data, no DOM. The page walks this list; nothing here knows how it is
 * drawn.
 */
import type { UpgradeState } from '../camera.svelte';
import type { HaloLevel } from '../config';

/**
 * Raise this whenever a question, an option or a measurement changes meaning,
 * so that runs of different versions of the test are never compared as if
 * they were the same thing. It is sent with every run.
 */
export const PROTOCOL_VERSION = 1;

/** What an answer is filed as for analysis, as opposed to the words on the button. */
export type Value = string | number | boolean | null;

export interface Option {
	/** What the tester sees. */
	label: string;
	/** What is sent for analysis: stays the same when the wording changes. */
	value: Value;
}

export interface Choice {
	kind: 'choice';
	name: string;
	label: string;
	options: Option[];
	/** The unit of a numeric value; it becomes part of the key the answer is sent under. */
	unit?: string;
	/** A blank answer is accepted and sent as such. */
	optional?: true;
}

export interface FreeText {
	kind: 'text';
	name: string;
	label: string;
	placeholder?: string;
	/** A number is expected: phones show the number keypad, and it is sent as a number. */
	numeric?: true;
	/** The unit of a numeric value; it becomes part of the key the answer is sent under. */
	unit?: string;
	/** A blank answer is accepted and sent as such. */
	optional?: true;
}

export type Question = Choice | FreeText;

export interface Step {
	id: string;
	title: string;
	/** What to do, in the order it should be done. */
	instructions: string[];
	questions: Question[];
	/** The app puts the picture at this magnification before asking. */
	zoom?: number;
	/** The app sets the light to this before asking. */
	light?: HaloLevel;
	/** The camera is needed from this step onwards. */
	needsCamera?: boolean;
	/**
	 * A countdown the tester waits out, in seconds. The step's questions are about
	 * the wait, so they are shown only once it is over.
	 */
	waitSeconds?: number;
	/**
	 * Asked before the countdown, which starts the moment they are answered —
	 * for a reading that has to be taken right at the start of the wait.
	 */
	beforeWait?: Question[];
	/**
	 * Said beside the button that leaves this step, for anything the tester has
	 * to do while the next step is arriving rather than after it has.
	 */
	before?: string;
	/**
	 * The panel is dark on this step. A light panel is a lamp in its own right,
	 * and on the light step it would add to the light being judged.
	 */
	darkSheet?: true;
	/**
	 * Arriving at this step, the panel is closed to its bar, so the whole picture
	 * is in view while there is something on it to watch. Coming back to the
	 * step to change an answer, it opens as usual.
	 */
	startClosed?: true;
	/**
	 * A file the tester needs, shown as a button with a line saying what it is
	 * for. It opens in a new tab rather than downloading: hard rule 1 allows no
	 * download feature, and a PDF viewer prints it just the same.
	 */
	link?: { href: string; label: string; note: string };
}

/** The cap heights printed on the card, smallest first. */
export const TEXT_HEIGHTS = ['1.00', '1.25', '1.50', '2.00', '2.50', '3.00', '4.00'];

/** 'none' rather than null: not one line made sharp is an answer, unlike a blank. */
const NONE: Option = { label: 'none of them', value: 'none' };

const yesNo = (name: string, label: string): Choice => ({
	kind: 'choice',
	name,
	label,
	options: [
		{ label: 'yes', value: true },
		{ label: 'no', value: false }
	]
});

const LIGHT_SCALE: Option[] = [
	{ label: '1 — not enough', value: 1 },
	{ label: '2 — usable', value: 2 },
	{ label: '3 — plenty', value: 3 }
];

/** Options whose words are their own value. */
const plain = (...words: string[]): Option[] => words.map((w) => ({ label: w, value: w }));

export const STEPS: Step[] = [
	{
		id: 'phone',
		title: 'Which phone is this?',
		instructions: [
			'Keep this page open to the end. Nothing is saved, so a reload loses the answers.'
		],
		link: {
			href: '/testcard.pdf',
			label: 'Test card (PDF)',
			note: 'The test needs this card, printed.'
		},
		questions: [
			{
				kind: 'text',
				name: 'phone',
				label: 'Phone, and which version of iOS or Android',
				placeholder: 'iPhone 14 Pro, iOS 26'
			}
		],
		/** Said next to the button that starts the camera, before there is anything to watch. */
		before:
			'Pressing Next starts the camera and hides this panel. Watch the picture for the first few seconds: it may flicker, jump, go black or freeze. Then tap the bar at the bottom to answer.'
	},
	{
		id: 'start',
		title: 'Starting the camera',
		needsCamera: true,
		startClosed: true,
		zoom: 1,
		instructions: [],
		questions: [
			yesNo(
				'flicker',
				'In the first few seconds after the picture appeared, did it flicker, jump, go black or freeze?'
			),
			{
				kind: 'text',
				name: 'flickerWhat',
				label: 'If it did, what happened, and how many times? Leave blank if it did not.',
				placeholder: 'went black once / flickered twice / froze for a moment',
				optional: true
			}
		]
	},
	{
		// At the best resolution the app uses on this phone: the starting step held
		// the tester until the camera had settled on it. Magnified to the most the
		// mirror allows, because that is where a soft picture shows first. A pinch
		// can still change it, so the magnification is recorded with the answer:
		// the snapshot taken when Next is pressed.
		id: 'card',
		title: 'Card',
		needsCamera: true,
		zoom: 5,
		instructions: [
			'The picture is magnified five times. Drag it to see the text, then move the card slowly nearer and further.',
			'Leave the card where the text looks sharpest, and read the distance off the tape measure.'
		],
		questions: [
			{
				kind: 'choice',
				name: 'textSharp',
				unit: 'mm',
				label: 'Smallest line you can get sharp',
				options: [...TEXT_HEIGHTS.map((h) => ({ label: `${h} mm`, value: Number(h) })), NONE]
			},
			// Without it the line size says little: the nearer the card, the bigger
			// the text in the picture.
			{
				kind: 'text',
				name: 'sharpestAt',
				label: 'Distance from the card to the phone where the text is sharpest, in cm',
				placeholder: '35',
				numeric: true,
				unit: 'cm'
			}
		]
	},
	{
		id: 'light',
		title: 'Light',
		needsCamera: true,
		zoom: 1,
		light: 'bright',
		darkSheet: true,
		instructions: ['Leave the card where it is.'],
		questions: [
			{
				kind: 'choice',
				name: 'lightDark',
				label: 'Darken the room. Is there enough light on the card?',
				options: LIGHT_SCALE
			},
			{
				kind: 'choice',
				name: 'lightRoom',
				label: 'Now turn the room light on. How is the light on the card?',
				options: LIGHT_SCALE
			}
		]
	},
	{
		// The phone stays on its stand facing the card for the whole step, so the
		// ten minutes also show whether the picture drifts when nothing moves —
		// and the checks that need the phone touched come after, in that order.
		// The open panel is exactly half the screen, so the line just above it is
		// the middle of the screen: the mark both drift questions go by.
		id: 'ten-minutes',
		title: 'Ten minutes',
		needsCamera: true,
		zoom: 3,
		waitSeconds: 600,
		instructions: [
			'Leave the phone on its stand, facing the card, and note which part of the card is in the middle of the screen, just above this panel. Do not touch the phone while the countdown runs.'
		],
		beforeWait: [
			{
				kind: 'text',
				name: 'batteryBefore',
				label: 'Battery percentage now, before the countdown',
				placeholder: '78',
				numeric: true,
				unit: 'pct'
			}
		],
		questions: [
			// Before anything is touched, which would move the picture.
			{
				kind: 'choice',
				name: 'driftAlone',
				label: 'Compared with the start, the picture has',
				options: [
					{ label: 'not moved', value: 'none' },
					{ label: 'moved a little', value: 'little' },
					{ label: 'moved a lot', value: 'lot' }
				]
			},
			// Next, because the percentage goes on falling while the rest are answered.
			{
				kind: 'text',
				name: 'batteryAfter',
				label: 'Battery percentage now, after the countdown',
				placeholder: '71',
				numeric: true,
				unit: 'pct'
			},
			{
				kind: 'choice',
				name: 'driftNudge',
				label:
					'Nudge the stand by about a centimetre, then drag the picture until the part of the card that was in the middle is back in the middle. That was',
				options: plain('easy', 'annoying')
			},
			yesNo('handChanged', 'Hold a hand in the middle of the picture. Does anything change?'),
			{
				kind: 'choice',
				name: 'warmth',
				label: 'Pick the phone up. It feels',
				options: plain('normal', 'warm', 'hot')
			},
			yesNo('smooth', 'Move and zoom the picture with your fingers. Does it stay smooth?'),
			{
				kind: 'text',
				name: 'notes',
				label: 'Anything else you noticed, in any language',
				placeholder: '',
				optional: true
			}
		]
	}
];

export const isLastStep = (index: number, steps: Step[] = STEPS) => index === steps.length - 1;

/**
 * How long the starting step waits for the resolution probe before letting the
 * tester go on anyway. The probe itself takes about two seconds; this is only
 * there so that a camera that never reports back cannot trap anyone.
 */
export const PROBE_WAIT_MS = 10_000;

/**
 * Whether the camera kept a higher resolution than it started with. `null`
 * while the probe is still running, or when it never ran.
 */
export function raisedFrom(state: UpgradeState): boolean | null {
	if (state === 'upgraded') return true;
	if (state === 'fellback' || state === 'unavailable' || state === 'skipped') return false;
	return null;
}

/** The step counter: this step's place in the test, out of all its steps. */
export function counterText(currentId: string, steps: Step[] = STEPS): string {
	const position = Math.max(
		0,
		steps.findIndex((s) => s.id === currentId)
	);
	return `Step ${position + 1} of ${steps.length}`;
}
