import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

test('the manifest and the icons are served', async ({ page, request }) => {
	await page.goto('/');
	const href = await page.locator('link[rel=manifest]').getAttribute('href');
	const manifest = await request.get(new URL(href!, page.url()).toString());
	expect(manifest.ok()).toBe(true);

	const json = await manifest.json();
	expect(json.display).toBe('standalone');
	expect(json.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

	for (const icon of json.icons) {
		expect((await request.get(new URL(icon.src, page.url()).toString())).ok()).toBe(true);
	}
});

test('the app starts with no network once the service worker holds it', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);

	// The worker does not claim open pages, so it takes control on the next load.
	await page.reload();
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mirror');
	await expect(page.getByRole('button', { name: 'Start mirror' })).toBeVisible();
	await context.setOffline(false);
});

test('no install hint where the browser offers its own', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Home Screen')).toHaveCount(0);
});

test.describe('on iOS', () => {
	test.use({ userAgent: IPHONE });

	test('the install hint appears and can be dismissed for the visit', async ({ page }) => {
		await page.goto('/');
		const hint = page.getByText('add this page to your Home Screen');
		await expect(hint).toBeVisible();

		await page.getByRole('button', { name: 'Dismiss' }).click();
		await expect(hint).toHaveCount(0);

		// Nothing is stored, so it is offered again on the next visit.
		await page.reload();
		await expect(page.getByText('add this page to your Home Screen')).toBeVisible();
	});
});
