# Development

You need Node.js from `.nvmrc`, npm 12 and Git.

## Setup

```bash
npm install
```

```bash
npm run dev
```

On Linux, install the libcurl and font packages listed in the [README](https://github.com/outmanos/restless#linux).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app with live reload |
| `npm run lint` | Lint every package |
| `npm run type-check` | Type-check every package |
| `npm test` | Run unit tests |
| `npm run app-build` | Production build |
| `npm run app-package` | Build installers |

## Conventions

- Use React Router loaders and actions for data.
- Use React Aria for interactive elements.
- Use Tailwind utility classes.
- Add IPC handlers in `src/main/ipc` and expose them in `src/entry.preload.ts`.
- Buffer bulk database writes.

## Upgrading Electron

Update `electron` and `node-libcurl` together, then rebuild native modules with `npm install`. Check the window controls on Linux afterwards. See [Decisions](Decisions).

## Regenerating icons

Edit `packages/insomnia/src/icons/icon.svg`, then run this. It needs `rsvg-convert` and ImageMagick.

```bash
node packages/insomnia/scripts/generate-icons.mjs
```
