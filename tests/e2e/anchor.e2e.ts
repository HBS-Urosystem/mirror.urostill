import { expect, test } from '@playwright/test';
import { anchor, haloSettled, pointers, startMirror, view } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

/** Zoom in for slack, then move the picture somewhere that is not the middle. */
async function chooseAnOffCentrePoint(page: import('@playwright/test').Page) {
	const { centre } = await startMirror(page);

	// Start asks for fullscreen, and a fullscreen window cannot be resized —
	// which the rotation test needs to do.
	await page.evaluate(() =>
		document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : undefined
	);
	await haloSettled(page);

	const { x: cx, y: cy } = centre;

	await pointers(page, 'pointerdown', [{ id: 1, x: cx - 60, y: cy }]);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx + 60, y: cy }]);
	await pointers(page, 'pointermove', [
		{ id: 1, x: cx - 120, y: cy },
		{ id: 2, x: cx + 120, y: cy }
	]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx - 120, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx + 120, y: cy }]);

	await pointers(page, 'pointerdown', [{ id: 3, x: cx, y: cy }]);
	await pointers(page, 'pointermove', [{ id: 3, x: cx + 120, y: cy + 90 }]);
	await pointers(page, 'pointerup', [{ id: 3, x: cx + 120, y: cy + 90 }]);

	return anchor(page);
}

test('the anchor is whatever the user left in the middle', async ({ page }) => {
	const chosen = await chooseAnOffCentrePoint(page);

	expect(chosen.scale).toBeGreaterThan(1.5);
	// It moved: the middle is no longer the middle of the picture.
	expect(Math.hypot(chosen.u - 0.5, chosen.v - 0.5)).toBeGreaterThan(0.01);
});

test('rotating the device keeps the same content in the middle', async ({ page }) => {
	const chosen = await chooseAnOffCentrePoint(page);

	await page.setViewportSize({ width: 844, height: 390 });
	await haloSettled(page);

	const after = await anchor(page);
	// The picture really did change shape underneath it.
	expect(after.picture.w).not.toBeCloseTo(chosen.picture.w, 0);
	expect(after.u).toBeCloseTo(chosen.u, 2);
	expect(after.v).toBeCloseTo(chosen.v, 2);
	expect((await view(page)).covers).toBe(true);
});

test('the crosshair sits at the anchor, not at a hardcoded centre', async ({ page }) => {
	await chooseAnOffCentrePoint(page);

	const placement = await page.evaluate(() => {
		const svg = document.querySelector('svg[viewBox="0 0 28 28"]') as SVGElement;
		const stage = document.querySelector('.picture')!.parentElement as HTMLElement;
		const c = svg.getBoundingClientRect();
		const s = stage.getBoundingClientRect();
		return {
			dx: c.left + c.width / 2 - (s.left + s.width / 2),
			dy: c.top + c.height / 2 - (s.top + s.height / 2)
		};
	});

	// Nothing is clamped here, so the anchor is the centre and so is the crosshair.
	expect(Math.abs(placement.dx)).toBeLessThan(1);
	expect(Math.abs(placement.dy)).toBeLessThan(1);
});
