import { defineConfig, devices } from '@playwright/test';

const PORT = 4183;

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	/*
		Its own port, and never a server it did not start. Reusing whatever
		happened to be listening once had the whole suite testing a build from
		before the change under test — green, and meaningless. A port collision
		is now an error rather than a silent substitution, and `preview:lan` on
		4173 can go on running alongside.
	*/
	webServer: {
		command: `npm run build && vite preview --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: false,
		// The command builds first. Playwright's default of a minute has been
		// overrun by the build alone on a busy machine, failing every test
		// without running one.
		timeout: 180_000
	},
	use: { baseURL: `http://localhost:${PORT}` },
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					// A synthetic camera, so getUserMedia resolves without a prompt.
					args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
				}
			}
		}
	]
});
