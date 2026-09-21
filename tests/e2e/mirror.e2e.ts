import { expect, test } from '@playwright/test';

test('start plays a mirrored picture that covers the stage, exit returns to the intro', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start mirror' }).click();

	const video = page.locator('video');
	await expect(video).toBeVisible();
	await expect
		.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
		.toBeGreaterThanOrEqual(2);

	// The picture is mirrored, and it is the element that carries the flip.
	await expect(video).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');

	// No empty edge: the picture is at least as big as the stage it sits in.
	const fit = await page.locator('.picture').evaluate((element) => {
		const picture = element.getBoundingClientRect();
		const stage = element.parentElement!.getBoundingClientRect();
		return { pw: picture.width, ph: picture.height, sw: stage.width, sh: stage.height };
	});
	expect(fit.pw).toBeGreaterThanOrEqual(fit.sw - 0.5);
	expect(fit.ph).toBeGreaterThanOrEqual(fit.sh - 0.5);

	await page.getByRole('button', { name: 'Exit' }).click();
	await expect(page.getByRole('button', { name: 'Start mirror' })).toBeVisible();
	await expect(video).toHaveCount(0);
});

test('the debug overlay is behind ?debug=1', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start mirror' }).click();
	await expect(page.getByText('wake lock')).toHaveCount(0);

	await page.goto('/?debug=1');
	await page.getByRole('button', { name: 'Start mirror' }).click();
	await expect(page.getByText('wake lock')).toBeVisible();
	await expect(page.getByText('src px / device px')).toBeVisible();
});

test('hiding the page releases the camera, coming back restarts it', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start mirror' }).click();

	const video = page.locator('video');
	await expect
		.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
		.toBeGreaterThan(0);

	const setVisibility = (state: 'hidden' | 'visible') =>
		page.evaluate((value) => {
			Object.defineProperty(document, 'visibilityState', { value, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		}, state);

	// Hidden: every track stops, so the camera indicator goes off.
	await setVisibility('hidden');
	await expect
		.poll(() => video.evaluate((el: HTMLVideoElement) => el.srcObject === null))
		.toBe(true);

	// Visible again: the mirror comes back without going through the intro.
	await setVisibility('visible');
	await expect
		.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
		.toBeGreaterThanOrEqual(2);
	await expect(page.getByRole('button', { name: 'Start mirror' })).toHaveCount(0);
});
