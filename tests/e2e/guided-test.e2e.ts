import { expect, test, type Page } from '@playwright/test';
import { convert, parseCsv } from '../../scripts/submissions-to-table.mjs';
import { haloSettled, view } from './helpers';

/**
 * The guided device test at /test. It is the one page in the app that sends
 * anything, so what it sends is checked here as well as that it walks.
 *
 * Playwright's fake camera advertises 4K but delivers about 20 frames a
 * second, so the resolution probe always sets it back to 1920×1080. Unless a
 * test says otherwise, it is walking the path for a phone that does not keep
 * a higher resolution.
 */

/** Answer everything on the step that is showing. */
async function answerStep(page: Page) {
	for (const box of await page.getByRole('textbox').all()) {
		// Optional boxes are left empty on purpose: a blank optional answer must
		// not stop the run. A box that wants a number gets one.
		if ((await box.getAttribute('aria-required')) !== 'true') continue;
		const numeric = (await box.getAttribute('inputmode')) === 'numeric';
		await box.fill(numeric ? '42' : 'something');
	}
	for (const group of await page.locator('fieldset').all()) {
		await group.getByRole('button').first().click();
	}
}

const stepTitle = (page: Page) => page.getByRole('heading', { level: 2 });
const counter = (page: Page) => page.getByText(/^Step \d+ of \d+/);
const panel = (page: Page) => page.locator('section').first();
const sendButton = (page: Page) => page.getByRole('button', { name: 'Send the results' });

/**
 * The step title, without waiting for it: while the countdown runs the panel is
 * only its top bar and has no title, which reads as ''.
 */
async function currentTitle(page: Page) {
	// One read of the page, not a count followed by a read: between those two
	// the panel can close — it does, on arriving at the camera step — and the
	// read would then wait for a title that is no longer there.
	return page.evaluate(() => document.querySelector('section h2')?.textContent?.trim() ?? '');
}

/**
 * Move to the next step. A waiting step has its countdown started, then
 * stopped, then its questions answered once they appear, and the button in
 * Next's place changes as that happens — so press whichever is there and judge
 * success by the heading changing, rather than waiting on a button that has
 * just been replaced. The last step has no Next: its countdown ends at the
 * send button, and reaching that counts as having moved on.
 */
async function advance(page: Page) {
	const before = await currentTitle(page);
	const start = page.getByRole('button', { name: 'Start the countdown' });
	const skip = page.getByRole('button', { name: 'Stop early' });
	const next = page.getByRole('button', { name: 'Next' });
	// A step that arrives with its panel closed is opened, so its title can be read.
	const closedBar = page.getByRole('button', { name: /Show$/ });

	for (let attempt = 0; attempt < 20; attempt++) {
		if (await closedBar.isVisible()) await closedBar.click();
		if (await start.isVisible()) {
			await start.click();
		} else if (await skip.isVisible()) {
			await skip.click();
			// A waiting step's questions appear only now.
			await answerStep(page);
		} else {
			await next.click({ timeout: 2000 }).catch(() => {});
		}
		const now = await currentTitle(page);
		if (now && now !== before) return;
		if (await sendButton(page).isVisible()) return;
		if (await closedBar.isVisible()) await closedBar.click();
		const opened = await currentTitle(page);
		if (opened && opened !== before) return;
	}
	throw new Error(`stuck on "${before}"`);
}

/**
 * Answer and advance until the send button, and return each step passed
 * through, once each, with what its counter said. `atEachStep` runs on
 * arriving at a step, before anything on it is answered.
 */
async function walkToEnd(page: Page, atEachStep?: (title: string) => Promise<void>) {
	const seen: { title: string; counter: string }[] = [];
	for (let guard = 0; guard < 20; guard++) {
		const title = await currentTitle(page);
		if (seen.at(-1)?.title !== title) {
			seen.push({ title, counter: ((await counter(page).textContent()) ?? '').trim() });
			await atEachStep?.(title);
		}
		if (await sendButton(page).isVisible()) break;
		await answerStep(page);
		await advance(page);
	}
	return seen;
}

/** Answer and advance until the step with this title is showing. */
async function walkTo(page: Page, title: string) {
	for (let guard = 0; guard < 20; guard++) {
		if ((await currentTitle(page)) === title) return;
		await answerStep(page);
		await advance(page);
	}
	throw new Error(`never reached "${title}"`);
}

/**
 * Make the probe keep the higher resolution, the way it does on a capable
 * phone. Without a per-frame callback the app takes the camera's own word for
 * its frame rate, and the camera is made to say 30. No timers are involved: an
 * earlier version counted frames from a timer, and on a busy machine the timer
 * fell behind, the probe saw too few frames and the test took the other path.
 */
async function cameraThatKeepsUp(page: Page) {
	await page.addInitScript(() => {
		delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback;
		const getSettings = MediaStreamTrack.prototype.getSettings;
		MediaStreamTrack.prototype.getSettings = function () {
			return { ...getSettings.call(this), frameRate: 30 };
		};
	});
}

/**
 * A camera that reports how far it is focused, the way Chrome does on an
 * Android phone with an autofocus front camera. The distance is whatever the
 * test puts in `window.focusM`, so the test plays the part of the card moving.
 */
async function cameraThatFocuses(page: Page) {
	await page.addInitScript(() => {
		const w = window as unknown as { focusM: number };
		w.focusM = 0.4;
		const getCapabilities = MediaStreamTrack.prototype.getCapabilities;
		MediaStreamTrack.prototype.getCapabilities = function () {
			const range = { min: 0.1, max: 2, step: 0.01 };
			return { ...getCapabilities.call(this), focusDistance: range } as MediaTrackCapabilities;
		};
		const getSettings = MediaStreamTrack.prototype.getSettings;
		MediaStreamTrack.prototype.getSettings = function () {
			return { ...getSettings.call(this), focusDistance: w.focusM } as MediaTrackSettings;
		};
	});
}

/** A camera that says nothing about its focus, the way an iPhone's front camera does in Safari. */
async function cameraWithoutFocus(page: Page) {
	await page.addInitScript(() => {
		const withoutFocus = <T extends object>(o: T): T => {
			const copy = { ...o } as T & { focusDistance?: unknown };
			delete copy.focusDistance;
			return copy;
		};
		const getCapabilities = MediaStreamTrack.prototype.getCapabilities;
		MediaStreamTrack.prototype.getCapabilities = function () {
			return withoutFocus(getCapabilities.call(this));
		};
		const getSettings = MediaStreamTrack.prototype.getSettings;
		MediaStreamTrack.prototype.getSettings = function () {
			return withoutFocus(getSettings.call(this));
		};
	});
}

const moveCardTo = (page: Page, metres: number) =>
	page.evaluate((m) => ((window as unknown as { focusM: number }).focusM = m), metres);

async function startTest(page: Page, phone = 'Test phone') {
	await page.goto('/test');
	await page.getByRole('textbox').fill(phone);
	await advance(page);
	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);
}

test('it will not move on until the step is answered', async ({ page }) => {
	await page.goto('/test');
	await expect(stepTitle(page)).toHaveText('Which phone is this?');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText('Fill this in.')).toBeVisible();
	await expect(stepTitle(page)).toHaveText('Which phone is this?');

	await page.getByRole('textbox').fill('Test phone');
	await expect(page.getByText('Fill this in.')).toHaveCount(0);
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(counter(page)).toHaveText('Step 2 of 6');
});

test('the camera starts with the panel out of the way, and the bar brings it back', async ({
	page
}) => {
	await page.goto('/test');
	await page.getByRole('textbox').fill('Test phone');
	await page.getByRole('button', { name: 'Next' }).click();

	// Only the bar: the whole picture is in view while there is something to watch.
	const bar = page.getByRole('button', { name: /^Step 2 of 6/ });
	await expect(bar).toHaveAttribute('aria-expanded', 'false');
	await expect(stepTitle(page)).toHaveCount(0);
	expect((await panel(page).boundingBox())!.height).toBeLessThan(100);

	await bar.click();
	await expect(stepTitle(page)).toHaveText('Starting the camera');
	await expect(page.locator('fieldset').first()).toContainText('did it flicker');

	// Back from the next step, to change the answer, it is open from the start.
	await answerStep(page);
	await page.getByRole('button', { name: 'Next' }).click({ timeout: 15000 });
	await expect(stepTitle(page)).toHaveText('Card');
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(stepTitle(page)).toHaveText('Starting the camera');
});

test('the warning to watch the picture comes before the camera starts', async ({ page }) => {
	await page.goto('/test');
	await expect(stepTitle(page)).toHaveText('Which phone is this?');
	const warning = page.getByText('Watch the picture for the first few seconds');
	await expect(warning).toBeVisible();

	// And it is beside the button that starts the camera.
	const warningBox = (await warning.boundingBox())!;
	const buttonBox = (await page.getByRole('button', { name: 'Next' }).boundingBox())!;
	expect(buttonBox.y).toBeGreaterThan(warningBox.y);
	expect(buttonBox.y - (warningBox.y + warningBox.height)).toBeLessThan(40);
});

test('it holds the starting step until the camera has finished changing resolution', async ({
	page
}) => {
	await page.goto('/test');
	await page.getByRole('textbox').fill('Test phone');
	await advance(page);
	await expect(stepTitle(page)).toHaveText('Starting the camera');

	const waiting = page.getByRole('button', { name: 'Waiting for the camera…' });
	await expect(waiting).toBeVisible();
	await expect(waiting).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled({ timeout: 15000 });
});

test('it puts the picture at the magnification each step asks for', async ({ page }) => {
	await startTest(page);
	await haloSettled(page);
	const atOne = (await view(page)).scale;

	await walkTo(page, 'Card');
	expect((await view(page)).scale / atOne).toBeCloseTo(5, 1);

	await walkTo(page, 'Light');
	expect((await view(page)).scale / atOne).toBeCloseTo(1, 1);

	await walkTo(page, 'Ten minutes');
	expect((await view(page)).scale / atOne).toBeCloseTo(3, 1);
});

test('the panel is never more than half the screen, and only a bar while the countdown runs', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 700 });
	const half = 350;
	const height = async () => (await panel(page).boundingBox())!.height;

	await page.goto('/test');
	expect(await height()).toBeLessThanOrEqual(half);
	await page.getByRole('textbox').fill('Test phone');
	await advance(page);

	for (const title of ['Starting the camera', 'Card', 'Light', 'Ten minutes']) {
		await walkTo(page, title);
		expect(await height(), title).toBeLessThanOrEqual(half);
	}

	await answerStep(page);
	await page.getByRole('button', { name: 'Start the countdown' }).click();
	expect(await height()).toBeLessThan(100);

	await page.getByRole('button', { name: 'Stop early' }).click();
	expect(await height()).toBeLessThanOrEqual(half);
});

test('the panel is dark on the light step, so it adds no light of its own', async ({ page }) => {
	const lightness = () =>
		panel(page).evaluate((el) => {
			const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number);
			return (r + g + b) / 3;
		});

	await startTest(page);
	await walkTo(page, 'Card');
	expect(await lightness()).toBeGreaterThan(200);
	await walkTo(page, 'Light');
	expect(await lightness()).toBeLessThan(80);
});

test('every step opens at its own top, not where the last one was left', async ({ page }) => {
	// Small enough that the panel has to scroll, which is the whole point.
	await page.setViewportSize({ width: 390, height: 600 });
	await startTest(page);
	await walkTo(page, 'Card');

	const sheet = page.locator('section div.overflow-y-auto');
	// Scroll to the bottom of this step, the way answering its last question does.
	await sheet.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
	const scrolled = await sheet.evaluate((el) => el.scrollTop);
	expect(scrolled, 'the panel must overflow, or this proves nothing').toBeGreaterThan(0);

	await answerStep(page);
	await advance(page);
	await expect(stepTitle(page)).toHaveText('Light');
	await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBe(0);

	// The new step's title holds focus, so a keyboard or a screen reader starts
	// at the top of it and a phone keyboard from the last answer is closed.
	await expect(stepTitle(page)).toBeFocused();

	// Going back lands at the top too.
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(stepTitle(page)).toHaveText('Card');
	await expect.poll(() => sheet.evaluate((el) => el.scrollTop)).toBe(0);
});

test('a camera that does not keep a higher resolution skips the 1920×1080 card step', async ({
	page
}) => {
	await startTest(page);

	const seen = await walkToEnd(page, async (title) => {
		if (title === 'Card') {
			// Nothing on screen says what the camera did: that goes in the report.
			await expect(page.getByText(/left out|did not keep/)).toHaveCount(0);
		}
	});
	const titles = seen.map((s) => s.title);

	expect(titles).toContain('Card');
	expect(titles).not.toContain('Card, 1920×1080');
	expect(titles.filter((t) => t.includes('high resolution'))).toEqual([]);

	// The total stays at six. The number jumps over the skipped step, and says
	// so from that moment on — not before, when nothing is missing yet.
	expect(seen.map((s) => s.counter)).toEqual([
		'Step 2 of 6',
		'Step 3 of 6',
		'Step 5 of 6 (1 skipped)',
		'Step 6 of 6 (1 skipped)'
	]);

	// The report says what was left out and why, rather than showing gaps.
	const sent = page.locator('pre');
	await expect(sent).toContainText('Card, 1920×1080');
	await expect(sent).toContainText('Skipped: the camera did not keep a higher resolution');
	await expect(sent).not.toContainText('(not answered)');
	await expect(sent).toContainText('raised, then set back for too few frames a second');

	// Both resolution changes, as the app saw them: up, then back down.
	await expect(sent).toContainText('Resolution changes while the camera started: 2');
	await expect(sent).toContainText('1920×1080 → 3840×2160');
	await expect(sent).toContainText('3840×2160 → 1920×1080');
	await expect(sent).toContainText('Longest pause between frames');
});

test('a camera that keeps the higher resolution is measured at both', async ({ page }) => {
	await cameraThatKeepsUp(page);
	await startTest(page);

	const titles = (await walkToEnd(page)).map((s) => s.title);
	expect(titles).toEqual(expect.arrayContaining(['Card, high resolution', 'Card, 1920×1080']));
	await expect(counter(page)).toHaveText('Step 6 of 6');

	const sent = page.locator('pre');
	await expect(sent).not.toContainText('Skipped');
	await expect(sent).toContainText('raised and kept');
	// This test takes the per-frame callback away, and the report says so.
	await expect(sent).toContainText(
		'Resolution changes while the camera started: not measurable in this browser'
	);
});

test('going back through a step records its measurements once, not twice', async ({ page }) => {
	await startTest(page);

	// Through the starting step, back to it, and through it again.
	await answerStep(page);
	await advance(page);
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(stepTitle(page)).toHaveText('Starting the camera');
	await advance(page);

	// The same with the card step.
	await expect(stepTitle(page)).toHaveText('Card');
	await answerStep(page);
	await advance(page);
	await page.getByRole('button', { name: 'Back' }).click();
	await expect(stepTitle(page)).toHaveText('Card');
	await advance(page);

	await walkToEnd(page);
	const sent = (await page.locator('pre').textContent()) ?? '';
	const times = (text: string) => sent.split(text).length - 1;
	expect(times('Camera can do at most')).toBe(1);
	expect(times('Camera detail per screen pixel — card')).toBe(1);
});

test('the ten minutes start when the battery reading is in, and the rest is asked after', async ({
	page
}) => {
	await startTest(page);
	await walkTo(page, 'Ten minutes');
	const clock = page.getByText(/^\d+:\d\d left$/);

	// Before: the battery reading alone, on the number keypad, and no clock yet.
	const box = page.getByRole('textbox');
	await expect(box).toHaveCount(1);
	await expect(box).toHaveAttribute('inputmode', 'numeric');
	await expect(clock).toHaveCount(0);
	await expect(sendButton(page)).toHaveCount(0);

	// Not without the reading.
	await page.getByRole('button', { name: 'Start the countdown' }).click();
	await expect(page.getByText('Fill this in.')).toBeVisible();
	await expect(clock).toHaveCount(0);

	// With it, the clock starts at once, and no question is on screen while it runs.
	await box.fill('78');
	await page.getByRole('button', { name: 'Start the countdown' }).click();
	await expect(clock).toBeVisible();
	await expect(page.getByRole('textbox')).toHaveCount(0);
	await expect(page.locator('fieldset')).toHaveCount(0);

	// Stopped early, it stays stopped — past the next tick of the clock, too.
	await page.getByRole('button', { name: 'Stop early' }).click();
	await page.waitForTimeout(1500);
	await expect(clock).toHaveCount(0);

	// Afterwards: no instructions for the wait any more, just what to do now —
	// first the check that has to come before the phone is touched, then the
	// second reading.
	await expect(page.getByText('Note which part of the card')).toHaveCount(0);
	await expect(page.locator('fieldset').first()).toContainText('Compared with the start');
	const after = page.getByRole('textbox').first();
	await expect(after).toHaveAttribute('placeholder', '71');
	await answerStep(page);
	await after.fill('71');

	const sent = page.locator('pre');
	await expect(sent).toContainText('Battery percentage now, before the countdown: 78');
	await expect(sent).toContainText('Battery percentage now, after the countdown: 71');
	await expect(sent).toContainText('Screen stayed on through the countdown: yes');
	await expect(sent).toContainText('Countdown: stopped early with');
	await expect(sendButton(page)).toBeVisible();
});

test('it records it when the screen goes off during the countdown', async ({ page }) => {
	await startTest(page);
	await walkTo(page, 'Ten minutes');
	await answerStep(page);
	await page.getByRole('button', { name: 'Start the countdown' }).click();

	// What the browser does when the screen locks: the page is hidden, then shown again.
	const visibility = (state: 'hidden' | 'visible') =>
		page.evaluate((state) => {
			Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		}, state);
	await visibility('hidden');
	await visibility('visible');

	await page.getByRole('button', { name: 'Stop early' }).click();
	await answerStep(page);
	await expect(page.locator('pre')).toContainText(
		'Screen stayed on through the countdown: no, the screen went off or the app was left with'
	);
});

test('the whole step bar shows and hides the panel', async ({ page }) => {
	await startTest(page);
	const bar = page.getByRole('button', { name: /^Step 2 of 6/ });
	await expect(bar).toHaveAttribute('aria-expanded', 'true');

	// Anywhere on it, not only the word at its end: here, the step counter.
	await counter(page).click();
	await expect(stepTitle(page)).toHaveCount(0);
	await expect(bar).toHaveAttribute('aria-expanded', 'false');
	expect((await panel(page).boundingBox())!.height).toBeLessThan(100);

	await counter(page).click();
	await expect(stepTitle(page)).toBeVisible();
	await expect(bar).toHaveAttribute('aria-expanded', 'true');
});

test('on a camera that reports its focus, the step bar shows it once the card moves', async ({
	page
}) => {
	let posted = '';
	await page.route('**/', async (route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		posted = route.request().postData() ?? '';
		await route.fulfill({ status: 200, body: 'ok' });
	});
	await cameraThatFocuses(page);
	await startTest(page);
	await walkTo(page, 'Card');
	const readout = page.getByText(/^focused at \d+ cm$/);

	// The same number all along could be one the browser stopped refreshing.
	await page.waitForTimeout(800);
	await expect(readout).toHaveCount(0);

	await moveCardTo(page, 0.34);
	await expect(readout).toHaveText('focused at 34 cm');
	// In the bar, so it shows with the panel closed too.
	await page.getByRole('button', { name: /Hide$/ }).click();
	await expect(readout).toBeVisible();
	await page.getByRole('button', { name: /Show$/ }).click();

	// What the camera said when the card step was answered goes in the report.
	await walkToEnd(page);
	await expect(page.locator('pre')).toContainText('Camera focused at — card: 34 cm');
	await sendButton(page).click();
	await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toBeVisible();
	const data = JSON.parse(new URLSearchParams(posted).get('data')!);
	expect(data.camera).toMatchObject({ focusReported: true, focusMoved: true });
	expect(data.detail['card-best'].focusM).toBe(0.34);
});

test('on a camera that does not report its focus, the bar shows no distance', async ({ page }) => {
	await cameraWithoutFocus(page);
	await startTest(page);
	await walkTo(page, 'Card');
	await page.waitForTimeout(800);
	await expect(page.getByText(/^focused at/)).toHaveCount(0);

	await walkToEnd(page);
	const sent = page.locator('pre');
	await expect(sent).toContainText('Reports how far it is focused: no');
	await expect(sent).not.toContainText('Camera focused at');
});

test('a focus distance that cannot be a card on a table is neither shown nor recorded', async ({
	page
}) => {
	// Chromium's fake camera reports a focus range, and 50 m as its setting.
	await startTest(page);
	await walkTo(page, 'Card');
	await page.waitForTimeout(800);
	await expect(page.getByText(/^focused at/)).toHaveCount(0);

	await walkToEnd(page);
	const sent = page.locator('pre');
	await expect(sent).toContainText('Reports how far it is focused: yes');
	await expect(sent).not.toContainText('Camera focused at');
});

test('it hides the mirror controls, so only the test drives the picture', async ({ page }) => {
	await page.goto('/test');
	await page.getByRole('textbox').fill('Test phone');
	await advance(page);
	await expect(page.locator('video')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Exit' })).toHaveCount(0);
});

test('it sends the answers and its own measurements, once, at the end', async ({ page }) => {
	let posted: string | null = null;
	await page.route('**/', async (route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		posted = route.request().postData();
		await route.fulfill({ status: 200, body: 'ok' });
	});

	await startTest(page, 'A particular phone');
	await walkToEnd(page);
	await expect(stepTitle(page)).toHaveText('Ten minutes');
	expect(posted).toBeNull();

	await sendButton(page).click();
	await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toBeVisible();

	const body = new URLSearchParams(posted!);
	expect(body.get('form-name')).toBe('mirror-test');
	expect(body.get('phone')).toBe('A particular phone');

	const summary = body.get('summary')!;
	// Every question that was asked is in there, answered.
	expect(summary).not.toContain('(not answered)');
	expect(summary).toContain('did it flicker, jump, go black or freeze?');
	// The optional box was left empty, and says so rather than looking skipped.
	expect(summary).toContain('how many times? Leave blank if it did not.: (left blank)');
	expect(summary).toContain('Finest group where you can still see three separate bars');
	// And the numbers nobody had to copy down.
	expect(summary).toContain('Measured by the app');
	expect(summary).toContain('Camera can do at most');
	expect(summary).toContain('Camera detail per screen pixel');
	expect(summary).toContain('Screen stayed on through the countdown');

	// The same run as data: fixed keys, and values a script can use as they are.
	const data = JSON.parse(body.get('data')!);
	expect(data.version).toBe(1);
	expect(data.skipped).toEqual(['card-base']);
	expect(data.answers).toMatchObject({
		phone: 'A particular phone',
		flicker: true,
		flickerWhat: null,
		barsBest_mm: 0.15,
		textBest_mm: 1,
		sharp30: true,
		barsBase_mm: null,
		lightDark: 1,
		batteryBefore_pct: 42,
		batteryAfter_pct: 42,
		driftAlone: 'none',
		warmth: 'normal'
	});
	expect(data.camera.outcome).toBe('fellback');
	expect(data.start.changes).toHaveLength(2);
	expect(data.countdown).toMatchObject({ screenStayedOn: true, stoppedEarly: true });

	// And through to the table: the export as Netlify writes it, then the script.
	const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
	const exported = [
		'created_at,phone,summary,data',
		['2026-10-03T12:00:00Z', 'A particular phone', summary, body.get('data')!].map(quote).join(',')
	].join('\n');
	const [header, row] = parseCsv(convert(exported));
	const column = (name: string) => row[header.indexOf(name)];
	expect(column('answers.barsBest_mm')).toBe('0.15');
	expect(column('answers.batteryAfter_pct')).toBe('42');
	expect(column('start.changes.2.toWidth')).toBe('1920');
	expect(header).not.toContain('summary');
});

test('it says so, and keeps the text, when the send fails', async ({ page }) => {
	await page.route('**/', async (route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		await route.fulfill({ status: 500, body: 'no' });
	});

	await startTest(page);
	await walkToEnd(page);
	await sendButton(page).click();

	await expect(page.getByText('It did not go through')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toHaveCount(0);
	await expect(page.locator('pre')).toContainText('Camera can do at most');
});
