import { expect, test, type Page } from '@playwright/test';

interface Finger {
	id: number;
	x: number;
	y: number;
}

/**
 * The app listens to Pointer Events, so synthetic ones exercise the real
 * recogniser — including the two-finger paths Playwright cannot produce.
 */
// A 16:9 stream in a 16:9 window fits exactly, leaving nothing to pan at 1x.
// A phone-shaped window is both more representative and actually pannable.
test.use({ viewport: { width: 390, height: 844 } });

async function pointers(page: Page, type: string, fingers: Finger[]) {
	await page.evaluate(
		({ type, fingers }) => {
			const stage = document.querySelector('.picture')!.parentElement!;
			for (const finger of fingers) {
				stage.dispatchEvent(
					new PointerEvent(type, {
						pointerId: finger.id,
						clientX: finger.x,
						clientY: finger.y,
						bubbles: true,
						cancelable: true,
						pointerType: 'touch',
						isPrimary: finger.id === 1
					})
				);
			}
		},
		{ type, fingers }
	);
}

/** Scale and translation off the live transform, plus the no-empty-edge check. */
async function view(page: Page) {
	return page.evaluate(() => {
		const picture = document.querySelector('.picture') as HTMLElement;
		const stage = picture.parentElement as HTMLElement;
		const matrix = new DOMMatrix(getComputedStyle(picture).transform);
		const p = picture.getBoundingClientRect();
		const s = stage.getBoundingClientRect();
		return {
			scale: matrix.a,
			x: matrix.m41,
			y: matrix.m42,
			covers:
				p.left <= s.left + 0.5 &&
				p.right >= s.right - 0.5 &&
				p.top <= s.top + 0.5 &&
				p.bottom >= s.bottom - 0.5,
			centre: { x: s.left + s.width / 2, y: s.top + s.height / 2 },
			scrolled: window.scrollX !== 0 || window.scrollY !== 0
		};
	});
}

async function startMirror(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Start mirror' }).click();
	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);
	return view(page);
}

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

	await expect(exit).toBeVisible();
	await pointers(page, 'pointerdown', [{ id: 1, x: cx, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 1, x: cx, y: cy }]);
	await expect(exit).toHaveCount(0);

	// Far enough away in time not to read as a double tap.
	await page.waitForTimeout(400);
	await pointers(page, 'pointerdown', [{ id: 2, x: cx, y: cy }]);
	await pointers(page, 'pointerup', [{ id: 2, x: cx, y: cy }]);
	await expect(exit).toBeVisible();
});
