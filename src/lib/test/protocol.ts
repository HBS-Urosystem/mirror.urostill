/**
 * The guided test: what the tester is asked, in what order, and what the app
 * sets up for them before each question.
 *
 * Plain data, no DOM. The page walks this list; nothing here knows how it is
 * drawn.
 */
import type { HaloLevel } from '../config';

export interface Choice {
	kind: 'choice';
	name: string;
	label: string;
	options: string[];
}

export interface FreeText {
	kind: 'text';
	name: string;
	label: string;
	placeholder?: string;
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
	/** The app puts the camera at this resolution before asking. */
	resolution?: 'settled' | 'base';
	/** The camera is needed from this step onwards. */
	needsCamera?: boolean;
	/** A countdown the tester waits out, in seconds. */
	waitSeconds?: number;
}

/** The bar widths printed on the card, finest first. */
export const BAR_WIDTHS = ['0.15', '0.20', '0.25', '0.30', '0.40', '0.50', '0.75', '1.00'];
/** The cap heights printed on the card, smallest first. */
export const TEXT_HEIGHTS = ['1.00', '1.25', '1.50', '2.00', '2.50', '3.00', '4.00'];

const barQuestion = (name: string): Choice => ({
	kind: 'choice',
	name,
	label: 'Finest group where you can still see three separate bars',
	options: [...BAR_WIDTHS.map((w) => `${w} mm`), 'none of them']
});

const textQuestion = (name: string): Choice => ({
	kind: 'choice',
	name,
	label: 'Smallest line you can read without guessing',
	options: [...TEXT_HEIGHTS.map((h) => `${h} mm`), 'none of them']
});

const yesNo = (name: string, label: string): Choice => ({
	kind: 'choice',
	name,
	label,
	options: ['yes', 'no']
});

export const STEPS: Step[] = [
	{
		id: 'phone',
		title: 'Which phone is this?',
		instructions: [
			'This takes about twenty minutes, most of it waiting.',
			'You will need the printed test card, something to stand it up, and a room you can darken.',
			'Keep this page open until the end. Nothing is saved, so reloading loses the answers.'
		],
		questions: [
			{
				kind: 'text',
				name: 'phone',
				label: 'Phone, and which version of iOS or Android',
				placeholder: 'iPhone 14 Pro, iOS 26'
			}
		]
	},
	{
		id: 'start',
		title: 'Starting the camera',
		needsCamera: true,
		zoom: 1,
		resolution: 'settled',
		instructions: [
			'The picture is running, and the app has just asked the camera for its best quality.',
			'That takes a second or two and is normally invisible.'
		],
		questions: [
			yesNo('flicker', 'Did the picture flicker, jump or freeze in the first few seconds?')
		]
	},
	{
		id: 'focus',
		title: 'Can it focus?',
		needsCamera: true,
		zoom: 1,
		instructions: [
			'Stand the card up, lit evenly, with no glare across it.',
			'Hold the phone at each distance in turn and look at the largest line of text.',
			'Many front cameras cannot focus at all, so expect some distances to be soft.'
		],
		questions: [
			yesNo('sharp30', 'Sharp at 30 cm?'),
			yesNo('sharp35', 'Sharp at 35 cm?'),
			yesNo('sharp45', 'Sharp at 45 cm?')
		]
	},
	{
		id: 'bars-best',
		title: 'Bars, best quality',
		needsCamera: true,
		zoom: 5,
		resolution: 'settled',
		instructions: [
			'Card at 35 cm. The picture is magnified five times.',
			'Look along the row of bar groups, from the narrowest to the widest.',
			'Find the first group where you can still count three separate bars.'
		],
		questions: [barQuestion('barsBest')]
	},
	{
		id: 'text-best',
		title: 'Text, best quality',
		needsCamera: true,
		zoom: 3,
		resolution: 'settled',
		instructions: [
			'Card at 35 cm. The picture is magnified three times.',
			'Read down the lines of letters until you have to start guessing.'
		],
		questions: [textQuestion('textBest')]
	},
	{
		id: 'bars-base',
		title: 'Bars, lower quality',
		needsCamera: true,
		zoom: 5,
		resolution: 'base',
		instructions: [
			'The camera has been put back to the lower setting. Everything else is the same.',
			'Card at 35 cm, magnified five times. Find the finest group again.'
		],
		questions: [barQuestion('barsBase')]
	},
	{
		id: 'text-base',
		title: 'Text, lower quality',
		needsCamera: true,
		zoom: 3,
		resolution: 'base',
		instructions: ['Card at 35 cm, magnified three times. Read down the lines again.'],
		questions: [textQuestion('textBase')]
	},
	{
		id: 'light',
		title: 'Light',
		needsCamera: true,
		zoom: 1,
		light: 'bright',
		resolution: 'settled',
		instructions: [
			'The white frame around the picture is now at its widest, which is the app at its brightest.',
			'Darken the room, hold the card at 35 cm, and look at how well it is lit.',
			'Then turn the room light on and look again.'
		],
		questions: [
			{
				kind: 'choice',
				name: 'lightDark',
				label: 'With the room light off',
				options: ['1 — not enough', '2 — usable', '3 — plenty']
			},
			{
				kind: 'choice',
				name: 'lightRoom',
				label: 'With the room light on',
				options: ['1 — not enough', '2 — usable', '3 — plenty']
			}
		]
	},
	{
		id: 'ten-minutes',
		title: 'Ten minutes',
		needsCamera: true,
		zoom: 1,
		resolution: 'settled',
		waitSeconds: 600,
		instructions: [
			'Note the battery percentage, then put the phone down and leave it alone.',
			'Do not lock it or switch apps — the point is whether it keeps itself awake.',
			'Come back when the countdown reaches zero.'
		],
		questions: [
			yesNo('stayedOn', 'Did the screen stay on the whole time?'),
			{
				kind: 'text',
				name: 'battery',
				label: 'Battery percentage before and after',
				placeholder: '78 before, 71 after'
			},
			{
				kind: 'choice',
				name: 'warmth',
				label: 'How does the phone feel?',
				options: ['normal', 'warm', 'hot']
			},
			yesNo('smooth', 'Move and zoom the picture with your fingers — does it stay smooth?')
		]
	},
	{
		id: 'still',
		title: 'Does the picture stay still?',
		needsCamera: true,
		zoom: 3,
		resolution: 'settled',
		instructions: [
			'Stand the phone up at 35 cm, pointed at the card.',
			'Leave it completely alone for a minute and watch.',
			'Then nudge whatever it is standing on by a centimetre.',
			'Then hold a hand in the middle of the picture.'
		],
		questions: [
			{
				kind: 'choice',
				name: 'driftAlone',
				label: 'Left alone for a minute, the picture',
				options: ['stayed put', 'moved a little', 'wandered noticeably']
			},
			{
				kind: 'choice',
				name: 'driftNudge',
				label: 'After the nudge, getting back to what you were looking at was',
				options: ['not needed', 'easy', 'annoying']
			},
			yesNo('handChanged', 'Did holding a hand in the picture change anything?')
		]
	},
	{
		id: 'done',
		title: 'Anything else?',
		instructions: [
			'That is everything. The measurements the app took itself are included.',
			'Anything that surprised you is worth more than a blank box here.'
		],
		questions: [
			{
				kind: 'text',
				name: 'notes',
				label: 'Anything you noticed, in any language',
				placeholder: ''
			}
		]
	}
];

export const isLastStep = (index: number) => index === STEPS.length - 1;
