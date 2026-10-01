import { expect, test, type Page } from '@playwright/test';
import { haloSettled, view } from './helpers';

/**
 * The guided device test at /test. It is the one page in the app that sends
 * anything, so what it sends is checked here as well as that it walks.
 */

/** Answer everything on the step that is showing, then move on. */
async function answerStep(page: Page) {
	for (const box of await page.getByRole('textbox').all()) {
		await box.fill('something');
	}
	for (const group of await page.locator('fieldset').all()) {
		await group.getByRole('button').first().click();
	}
}

async function advance(page: Page) {
	const skip = page.getByRole('button', { name: 'Stop the wait early' });
	if (await skip.isVisible()) await skip.click();
	await page.getByRole('button', { name: 'Next' }).click();
}

const stepTitle = (page: Page) => page.getByRole('heading', { level: 2 });

test('it will not move on until the step is answered', async ({ page }) => {
	await page.goto('/test');
	await expect(stepTitle(page)).toHaveText('Which phone is this?');

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText('Fill this in.')).toBeVisible();
	await expect(stepTitle(page)).toHaveText('Which phone is this?');

	await page.getByRole('textbox').fill('Test phone');
	await expect(page.getByText('Fill this in.')).toHaveCount(0);
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(stepTitle(page)).toHaveText('Starting the camera');
});

test('it puts the picture at the magnification each step asks for', async ({ page }) => {
	await page.goto('/test');
	await page.getByRole('textbox').fill('Test phone');
	await advance(page);

	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);
	await haloSettled(page);

	// 'Starting the camera' and 'Can it focus?' are both 1×.
	const atOne = (await view(page)).scale;
	await answerStep(page);
	await advance(page);
	await answerStep(page);
	await advance(page);

	// 'Bars, best quality' is 5×.
	await expect(stepTitle(page)).toHaveText('Bars, best quality');
	expect((await view(page)).scale / atOne).toBeCloseTo(5, 1);

	await answerStep(page);
	await advance(page);

	// 'Text, best quality' is 3×.
	await expect(stepTitle(page)).toHaveText('Text, best quality');
	expect((await view(page)).scale / atOne).toBeCloseTo(3, 1);
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

	await page.goto('/test');
	await page.getByRole('textbox').fill('A particular phone');
	await advance(page);

	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);

	// Every step but the last, which has the Send button instead of Next.
	for (let guard = 0; guard < 20; guard++) {
		if (await page.getByRole('button', { name: 'Send the results' }).isVisible()) break;
		await answerStep(page);
		await advance(page);
	}

	await expect(stepTitle(page)).toHaveText('Anything else?');
	expect(posted).toBeNull();

	await answerStep(page);
	await page.getByRole('button', { name: 'Send the results' }).click();
	await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toBeVisible();

	const body = new URLSearchParams(posted!);
	expect(body.get('form-name')).toBe('mirror-test');
	expect(body.get('phone')).toBe('A particular phone');

	const summary = body.get('summary')!;
	// Every question that was asked is in there, answered.
	expect(summary).not.toContain('(not answered)');
	expect(summary).toContain('Did the picture flicker');
	expect(summary).toContain('Finest group where you can still see three separate bars');
	// And the numbers nobody had to copy down.
	expect(summary).toContain('Measured by the app');
	expect(summary).toContain('Camera can do at most');
	expect(summary).toContain('Camera detail per screen pixel');
});

test('it says so, and keeps the text, when the send fails', async ({ page }) => {
	await page.route('**/', async (route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		await route.fulfill({ status: 500, body: 'no' });
	});

	await page.goto('/test');
	await page.getByRole('textbox').fill('Test phone');
	await advance(page);
	await expect
		.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
		.toBeGreaterThanOrEqual(2);

	for (let guard = 0; guard < 20; guard++) {
		if (await page.getByRole('button', { name: 'Send the results' }).isVisible()) break;
		await answerStep(page);
		await advance(page);
	}
	await answerStep(page);
	await page.getByRole('button', { name: 'Send the results' }).click();

	await expect(page.getByText('It did not go through')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toHaveCount(0);
	await expect(page.locator('pre')).toContainText('Camera can do at most');
});
