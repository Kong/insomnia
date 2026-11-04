# Architecture

Restless is an Electron app, written in TypeScript with React and React Router.

## Packages

| Package | Purpose |
|---|---|
| `packages/insomnia` | The desktop app |
| `packages/insomnia-data` | Data models, services and NeDB storage |
| `packages/insomnia-inso` | The `rl` CLI |
| `packages/insomnia-scripting-environment` | Script APIs |
| `packages/insomnia-testing` | Test generation and runner |
| `packages/insomnia-smoke-test` | End-to-end tests |
| `packages/restless-plugin-secret-managers` | Secret manager plugin |
| `packages/insomnia-component-docs` | Component library docs |

Internal folders keep their `insomnia` names on purpose. It keeps future merges from Insomnia practical. See [Decisions](Decisions).

## Processes

| Process | Role |
|---|---|
| Main | Windows, menus, network, Git and files |
| Renderer | React interface |
| Plugin window | Runs plugins |
| Hidden window | Runs user scripts |
| Utility processes | AI generation and spec linting |
| Web worker | Template rendering |

The renderer calls the main process over IPC. Handlers live in `src/main/ipc`, and are exposed in `src/entry.preload.ts`.

## Data model

```text
Organization
  Project
    Workspace (collection, spec, mock server, MCP or environment)
      Environment and sub-environments
      Cookie jar
      Folders
        Requests
```

There is one built-in local organization.

## Requests

HTTP goes through libcurl using `node-libcurl`. On Linux it links the system `libcurl`.

## Title bar

macOS uses the native menu and window controls.

On Windows and Linux, the window is frameless. The menu bar is drawn by the app from the Electron menu, in `title-bar-menu.tsx`. Window controls come from Chromium's window controls overlay.

- `nativeTheme.themeSource` is set before the window is created, so the controls match the theme.
- The overlay sits above the page, so `syncTitleBarColors` recolors it when a dialog opens.
- On Linux, the icons follow the GTK theme.

## Git

Git runs through `isomorphic-git`, so a Git install isn't required.
