import { expect, type Page } from '@playwright/test';

export interface Finger {
	id: number;
	x: number;
	y: number;
}

/**
 * The app listens to Pointer Events, so synthetic ones exercise the real
 * recogniser — including the two-finger paths Playwright cannot produce.
 */
export async function pointers(page: Page, type: string, fingers: Finger[]) {
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

export async function tap(page: Page, x: number, y: number, id = 90) {
	await pointers(page, 'pointerdown', [{ id, x, y }]);
	await pointers(page, 'pointerup', [{ id, x, y }]);
}

/** Scale and translation off the live transform, plus the no-empty-edge check. */
export async function view(page: Page) {
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
			stage: { x: s.left, y: s.top, w: s.width, h: s.height },
			centre: { x: s.left + s.width / 2, y: s.top + s.height / 2 },
			scrolled: window.scrollX !== 0 || window.scrollY !== 0
		};
	});
}

/**
 * The halo opens over HALO_OPEN_MS, resizing the stage as it goes. Measuring
 * before it settles gives a view that is about to change under the test.
 */
export async function haloSettled(page: Page) {
	let previous = -1;
	for (let attempt = 0; attempt < 40; attempt++) {
		const width = await page
			.locator('.picture')
			.evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().width);
		if (width === previous) return;
		previous = width;
		await page.waitForTimeout(80);
	}
}

export async function startMirror(page: Page, query = '') {
	await page.goto(`/${query}`);
	await page.getByRole('button', { name: 'Start mirror' }).click();
	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);
	await haloSettled(page);
	return view(page);
}

/** The control pill hides itself after PILL_AUTOHIDE_MS; a tap brings it back. */
export async function showControls(page: Page) {
	const exit = page.getByRole('button', { name: 'Exit' });
	if (await exit.isVisible()) return;
	const { centre } = await view(page);
	await tap(page, centre.x, centre.y, 91);
	await expect(exit).toBeVisible();
}

/**
 * The content point held at the stage centre, in normalised picture
 * coordinates — the anchor, read back out of the DOM.
 */
export async function anchor(page: Page) {
	return page.evaluate(() => {
		const picture = document.querySelector('.picture') as HTMLElement;
		const matrix = new DOMMatrix(getComputedStyle(picture).transform);
		const w = parseFloat(picture.style.width);
		const h = parseFloat(picture.style.height);
		const s = matrix.a;
		// The transform opens with translate(-50%, -50%), so the element's own
		// size is folded into the matrix; take it back out to get the translation.
		const tx = matrix.m41 + w / 2;
		const ty = matrix.m42 + h / 2;
		return { u: -tx / s / w + 0.5, v: -ty / s / h + 0.5, picture: { w, h }, scale: s };
	});
}
