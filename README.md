# Mirror

A front-camera lighted mirror that runs in the browser and installs as a PWA.
It shows the front camera live and mirrored, lets you pinch to zoom and drag to
position the picture, keeps the screen awake, and turns the edge of the screen
into a white light frame.

Nothing is recorded, saved or sent. See [CLAUDE.md](CLAUDE.md) for the hard
rules that keep it that way, and [PLAN.md](PLAN.md) for the implementation plan.

## Getting started

```bash
npm install
npm run dev
```

The camera works on `localhost` without HTTPS. To try it on a phone on the same
network, use `npm run dev:https` and open the printed `https://192.168.x.x:5173`
address — a phone on plain `http://` gets no camera, and you will have to accept
the self-signed certificate.

## Commands

| Command                             | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `npm run dev`                       | Local dev on localhost                          |
| `npm run dev:https`                 | Dev over the LAN with a self-signed certificate |
| `npm run build` / `npm run preview` | Production build and local preview              |
| `npm run check`                     | svelte-check + TypeScript + `check:privacy`     |
| `npm run test`                      | Vitest                                          |
| `npm run test:e2e`                  | Playwright smoke tests                          |
| `npm run check:privacy`             | Scans `src/` for forbidden APIs                 |
| `node scripts/make-icons.mjs`       | Regenerates the PWA icons                       |

`npm run check` must pass before every commit.

## Deployment

Netlify, from `netlify.toml`: `npm run build`, publish `build`. Deploy previews
are the main way to test on phones, because they are real HTTPS with no
certificate warnings. In the Netlify site settings, turn **off** form detection
and snippet injection — both would inject third-party code and break hard rule 3.
