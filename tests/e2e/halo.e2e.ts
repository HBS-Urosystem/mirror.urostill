import { expect, test, type Page } from '@playwright/test';
import { haloSettled, pointers, showControls, startMirror, tap, view } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

const SHORT_SIDE = 390;
const LEVELS = { off: 0, soft: 0.08, bright: 0.16 };

/** The white frame: the root's background and how far it insets the stage. */
async function halo(page: Page) {
	return page.evaluate(() => {
		const stage = document.querySelector('.picture')!.parentElement as HTMLElement;
		const root = stage.parentElement as HTMLElement;
		const s = stage.getBoundingClientRect();
		const r = root.getBoundingClientRect();
		return {
			background: getComputedStyle(root).backgroundColor,
			left: s.left - r.left,
			top: s.top - r.top,
			right: r.right - s.right,
			bottom: r.bottom - s.bottom
		};
	});
}

test('the halo is pure white and insets the stage evenly on all four sides', async ({ page }) => {
	await startMirror(page);
	const frame = await halo(page);

	expect(frame.background).toBe('rgb(255, 255, 255)');
	const expected = SHORT_SIDE * LEVELS.bright;
	for (const side of [frame.left, frame.top, frame.right, frame.bottom]) {
		expect(side).toBeCloseTo(expected, 0);
	}
});

test('the light button walks down and back up, and says which it is', async ({ page }) => {
	await startMirror(page);
	await showControls(page);

	const light = () => page.getByRole('button', { name: /^Light: / });
	const rays = () => light().locator('line').count();

	/** One press, then what the button says, how wide the halo is, and its rays. */
	async function press() {
		await light().click();
		await haloSettled(page);
		await showControls(page);
		return {
			label: await light().getAttribute('aria-label'),
			inset: (await halo(page)).left,
			rays: await rays()
		};
	}

	await expect(light()).toHaveAttribute('aria-label', 'Light: bright');
	expect(await rays()).toBe(8);

	// It turns around at each end rather than wrapping, so the brightest is
	// never one press away from nothing.
	const walk = [await press(), await press(), await press(), await press()];
	expect(walk.map((step) => step.label)).toEqual([
		'Light: soft',
		'Light: off',
		'Light: soft',
		'Light: bright'
	]);
	expect(walk.map((step) => step.rays)).toEqual([4, 0, 4, 8]);

	expect(walk[0].inset).toBeCloseTo(SHORT_SIDE * LEVELS.soft, 0);
	expect(walk[1].inset).toBeCloseTo(0, 0);
	expect(walk[3].inset).toBeCloseTo(SHORT_SIDE * LEVELS.bright, 0);
});

test('the picture still covers the stage after the halo changes width', async ({ page }) => {
	await startMirror(page);
	await showControls(page);
	await page.getByRole('button', { name: /^Light: / }).click();
	await haloSettled(page);
	expect((await view(page)).covers).toBe(true);
});

test('the zoom readout shows the zoom and resets it', async ({ page }) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;
	await showControls(page);

	await pointers(page, 'pointerdown', [{ id: 1, x: cx - 50, y: cy }]);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx + 50, y: cy }]);
	await pointers(page, 'pointermove', [
		{ id: 1, x: cx - 100, y: cy },
		{ id: 2, x: cx + 100, y: cy }
	]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx - 100, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx + 100, y: cy }]);

	const readout = page.getByRole('button', { name: /^Zoom / });
	await expect(readout).toHaveText('2×');
	await expect(readout).toHaveAttribute('aria-label', 'Zoom 2×, tap to reset');

	await readout.click();
	await expect(readout).toHaveText('1×');
	expect((await view(page)).scale).toBeCloseTo(1, 6);
});

test('the pill holds its place as the light level changes', async ({ page }) => {
	await startMirror(page);
	await showControls(page);

	const box = async () => (await page.locator('.glass-smoke').boundingBox())!;
	const before = await box();

	for (let press = 0; press < 3; press++) {
		await page.getByRole('button', { name: /^Light: / }).click();
		await haloSettled(page);
		await showControls(page);
		expect(await box()).toEqual(before);
	}
});

test('hiding and showing the pill shifts nothing', async ({ page }) => {
	await startMirror(page);
	await showControls(page);
	const before = (await view(page)).stage;

	const { centre } = await view(page);
	await tap(page, centre.x, centre.y, 21);
	await expect(page.getByRole('button', { name: 'Exit' })).toHaveCount(0);

	expect((await view(page)).stage).toEqual(before);
});

test.describe('with reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the halo is simply there, with no opening', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Start mirror' }).click();
		await expect
			.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
			.toBeGreaterThanOrEqual(2);

		// No settling wait: it must already be at full width.
		expect((await halo(page)).left).toBeCloseTo(SHORT_SIDE * LEVELS.bright, 0);
	});
});
