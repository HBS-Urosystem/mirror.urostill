import { expect, test } from '@playwright/test';
import { pointers, showControls, startMirror, view } from './helpers';

// A 16:9 stream in a 16:9 window fits exactly, leaving nothing to pan at 1x.
// A phone-shaped window is both more representative and actually pannable.
test.use({ viewport: { width: 390, height: 844 } });

test('one finger pans the picture without revealing an edge or scrolling the page', async ({
	page
}) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;

	await pointers(page, 'pointerdown', [{ id: 1, x: cx, y: cy }]);
	await pointers(page, 'pointermove', [{ id: 1, x: cx + 120, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx + 120, y: cy }]);

	const after = await view(page);
	expect(after.x).toBeCloseTo(before.x + 120, 0);
	expect(after.scale).toBeCloseTo(before.scale, 6);
	expect(after.covers).toBe(true);
	expect(after.scrolled).toBe(false);
});

test('panning stops at the edge of the picture', async ({ page }) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;

	await pointers(page, 'pointerdown', [{ id: 1, x: cx, y: cy }]);
	await pointers(page, 'pointermove', [{ id: 1, x: cx + 20000, y: cy + 20000 }]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx + 20000, y: cy + 20000 }]);

	expect((await view(page)).covers).toBe(true);
});

test('two fingers zoom, and a double tap puts it back to 1x', async ({ page }) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;

	await pointers(page, 'pointerdown', [{ id: 1, x: cx - 50, y: cy }]);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx + 50, y: cy }]);
	await pointers(page, 'pointermove', [
		{ id: 1, x: cx - 150, y: cy },
		{ id: 2, x: cx + 150, y: cy }
	]);

	const zoomed = await view(page);
	expect(zoomed.scale).toBeCloseTo(3, 1);
	expect(zoomed.covers).toBe(true);

	await pointers(page, 'pointerup', [{ id: 1, x: cx - 150, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx + 150, y: cy }]);

	// Two taps in the same place, inside the double-tap window.
	for (let i = 0; i < 2; i++) {
		await pointers(page, 'pointerdown', [{ id: 3 + i, x: cx, y: cy }]);
		await pointers(page, 'pointerup', [{ id: 3 + i, x: cx, y: cy }]);
	}

	const reset = await view(page);
	expect(reset.scale).toBeCloseTo(1, 6);
	expect(reset.covers).toBe(true);
});

test('lifting one finger during a pinch carries on as a pan, with no jump', async ({ page }) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;

	await pointers(page, 'pointerdown', [{ id: 1, x: cx - 60, y: cy }]);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx + 60, y: cy }]);
	await pointers(page, 'pointermove', [
		{ id: 1, x: cx - 120, y: cy },
		{ id: 2, x: cx + 120, y: cy }
	]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx + 120, y: cy }]);

	const handover = await view(page);

	// The finger that stayed down now drags, from where it is.
	await pointers(page, 'pointermove', [{ id: 1, x: cx - 120, y: cy + 40 }]);
	const dragged = await view(page);

	expect(dragged.scale).toBeCloseTo(handover.scale, 6);
	expect(dragged.y).toBeCloseTo(handover.y + 40, 0);
	expect(dragged.covers).toBe(true);
});

test('a single tap hides the controls and shows them again', async ({ page }) => {
	const before = await startMirror(page);
	const { x: cx, y: cy } = before.centre;
	const exit = page.getByRole('button', { name: 'Exit' });

	// Start from a known state: the pill hides itself after three seconds.
	await showControls(page);
	await pointers(page, 'pointerdown', [{ id: 1, x: cx, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx, y: cy }]);
	await expect(exit).toHaveCount(0);

	// Far enough away in time not to read as a double tap.
	await page.waitForTimeout(400);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx, y: cy }]);
	await expect(exit).toBeVisible();
});
