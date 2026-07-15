# AGENTS.md — Shared Component Library

This is Insomnia's shared component library (React Aria + Tailwind). See the design/roadmap
in https://konghq.atlassian.net/wiki/spaces/~712020f987dca73e964e60aafab91ddc862706/pages/5729714608/Insomnia+Shared+Component+Library+Plan

## Conventions

- Build on `react-aria-components` (high-level) first; only drop to `react-aria` hooks when the
  high-level component can't meet the need (e.g. Tooltip's arbitrary non-focusable trigger).
- **Colors** use repo CSS variables (`token-(--var)`, e.g. `text-(--color-font)`, `bg-(--hl-sm)`).
  Everything else (size/spacing/radius/font) uses native Tailwind utilities — do NOT use
  `--padding-*` / `--radius-*` / `--font-size-*`. Hardcode a color only if no repo variable fits, with a `FIXME`.
- **Variants** use `tailwind-variants` (`tv`); non-variant components use `cn()` (tailwind-merge).
- **Preserve `theme--*` scope classes** (`theme--dialog`, `theme--tooltip`, `theme--dropdown__menu`,
  `theme--link`, …) on the matching component root — they are the per-component theming contract
  (`src/ui/plugins/misc.ts`). Dropping them silently breaks user theme customization.

## When you add or change a component → update its docs

Docs live in the Docusaurus site at `packages/insomnia-component-docs` (one MDX per component).
Use the **`component-docs` skill** to create/update the doc. Don't forget to register the component
in `src/theme/ReactLiveScope/index.ts` or its live examples won't compile.

A component is "done" only when its doc + ReactLiveScope entry are in place and the docs site builds
(`cd packages/insomnia-component-docs && npm run build`).
