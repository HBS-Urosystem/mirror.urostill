import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over the LAN with a self-signed certificate, so a
// phone can reach the camera. Never used in a build.
const devHttps = process.env.DEV_HTTPS === '1';

export default defineConfig({
	plugins: [
		...(devHttps ? [basicSsl()] : []),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Hard rule 3: the app talks to its own origin and nothing else.
			// `frame-ancestors` cannot travel in a <meta> CSP, so it lives in static/_headers.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					'media-src': ['self', 'blob:'],
					'connect-src': ['self'],
					'worker-src': ['self', 'blob:'],
					'manifest-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['none']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['tests/unit/**/*.{test,spec}.ts']
	}
});
