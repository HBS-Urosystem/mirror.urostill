import { expect, test, type Page } from '@playwright/test';
import { haloSettled, startMirror, view } from './helpers';

// A laptop: a fine pointer, a wheel and a keyboard, on a desktop-sized window.
test.use({ viewport: { width: 1280, height: 800 } });

async function stage(page: Page) {
	return page.locator('.picture').locator('..');
}

test('the intro reads for a computer and stays a centred column', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Click Start mirror')).toBeVisible();
	await expect(page.getByText('Tap Start mirror')).toHaveCount(0);
	await expect(page.getByText('Point the camera at what you want to see')).toBeVisible();

	const column = page.locator('h1').locator('../..');
	const box = (await column.boundingBox())!;
	expect(box.width).toBeLessThanOrEqual(420);
	// Centred in the window rather than pinned to one side.
	expect(box.x + box.width / 2).toBeCloseTo(640, -1);
});

test('the wheel zooms about the pointer, and the crosshair appears', async ({ page }) => {
	const before = await startMirror(page);
	expect(before.scale).toBeCloseTo(1, 6);

	const target = { x: before.centre.x + 200, y: before.centre.y };
	await page.mouse.move(target.x, target.y);
	await page.mouse.wheel(0, -100);

	await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(1.1);
	const zoomed = await view(page);
	expect(zoomed.covers).toBe(true);
	// Zoomed about the pointer, not the centre: the picture shifted sideways.
	expect(Math.abs(zoomed.x - before.x)).toBeGreaterThan(1);

	await expect(page.locator('svg[viewBox="0 0 28 28"]')).toBeVisible();
});

test('the trackpad pinch zooms in smaller steps than a wheel notch', async ({ page }) => {
	const before = await startMirror(page);
	await page.mouse.move(before.centre.x, before.centre.y);

	// ctrlKey set is how both macOS and Windows report a trackpad pinch.
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -2);
	await page.keyboard.up('Control');

	const after = await view(page);
	expect(after.scale).toBeGreaterThan(1);
	expect(after.scale).toBeLessThan(1.1);
});

test('the keyboard pans, zooms and resets', async ({ page }) => {
	await startMirror(page);
	await (await stage(page)).focus();

	// Zoom in first: at 1x this window has no slack to pan into, and the clamp
	// correctly refuses to move.
	await page.keyboard.press('+');
	const zoomed = await view(page);
	expect(zoomed.scale).toBeGreaterThan(1);

	await page.keyboard.press('ArrowRight');
	const panned = await view(page);
	expect(panned.x).toBeLessThan(zoomed.x);
	expect(panned.covers).toBe(true);

	// Shift moves further in one press.
	const step = zoomed.x - panned.x;
	await page.keyboard.press('Shift+ArrowLeft');
	const back = await view(page);
	expect(back.x - panned.x).toBeGreaterThan(step * 2);

	await page.keyboard.press('-');
	expect((await view(page)).scale).toBeCloseTo(1, 4);

	await page.keyboard.press('+');
	await page.keyboard.press('0');
	await expect.poll(async () => (await view(page)).scale).toBeCloseTo(1, 6);
});

test('tabbing reaches the stage and Escape leaves the mirror', async ({ page }) => {
	await startMirror(page);
	const element = await stage(page);

	await element.focus();
	await expect(element).toBeFocused();
	const outline = await element.evaluate((el) => getComputedStyle(el).outlineWidth);
	expect(parseFloat(outline)).toBeGreaterThan(0);

	// Start asks for fullscreen where the browser allows it. While that is on,
	// Escape belongs to the browser and must not exit the mirror underneath it.
	const intro = page.getByRole('button', { name: 'Start mirror' });
	if (await page.evaluate(() => !!document.fullscreenElement)) {
		await page.keyboard.press('Escape');
		await expect(intro).toHaveCount(0);
		await page.evaluate(() => document.exitFullscreen().catch(() => {}));
		await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
	}

	await page.keyboard.press('Escape');
	await expect(intro).toBeVisible();
});

test('moving the mouse brings the controls back without a click', async ({ page }) => {
	const before = await startMirror(page);
	const exit = page.getByRole('button', { name: 'Exit' });

	// Wait out the auto-hide.
	await expect(exit).toHaveCount(0, { timeout: 6000 });

	await page.mouse.move(before.centre.x, before.centre.y);
	await page.mouse.move(before.centre.x + 5, before.centre.y + 5);
	await expect(exit).toBeVisible();
});

test('the stage offers a grab cursor', async ({ page }) => {
	await startMirror(page);
	await haloSettled(page);
	const cursor = await (await stage(page)).evaluate((el) => getComputedStyle(el).cursor);
	expect(cursor).toBe('grab');
});

test.describe('with reduced motion', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the crosshair still appears, and then simply goes', async ({ page }) => {
		const before = await startMirror(page);
		const crosshair = page.locator('svg[viewBox="0 0 28 28"]');
		await expect(crosshair).toHaveCount(0);

		await page.mouse.move(before.centre.x, before.centre.y);
		await page.mouse.wheel(0, -100);
		await expect(crosshair).toBeVisible();

		// It holds, then leaves without a fade.
		await expect(crosshair).toHaveCount(0, { timeout: 4000 });
	});
});
