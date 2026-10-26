# `~/basic-components` — Shared Component Library

Insomnia's shared component library, built on `react-aria-components` + TailwindCSS. Full design/roadmap:
[Insomnia Shared Component Library Plan](https://konghq.atlassian.net/wiki/spaces/~712020f987dca73e964e60aafab91ddc862706/pages/5729714608/Insomnia+Shared+Component+Library+Plan) (Confluence). Conventions: [`AGENTS.md`](./AGENTS.md).

Full per-component docs (props, variants, live examples) live on the Docusaurus site
`packages/insomnia-component-docs`, not in this file.

## Import

```ts
import { Button, Modal, Icon } from '~/basic-components';
```

**Always import from the barrel (`~/basic-components`).** The barrel is the public contract; the
current file layout (flat) is an implementation detail. Physical layering into
`primitives/overlays/collections/layout/typography` is **deferred to M5** (see the plan) — because
consumers go through the barrel, that later move only edits the barrel's internal re-exports, never
a business import. New code and the docs' `ReactLiveScope` must use the barrel so those moves stay
free. Existing deep imports (`~/basic-components/button`, ~18 files) are left as-is until M5.

## Usage index (current)

| Component       | Barrel export | Location                                                                                |
| --------------- | ------------- | --------------------------------------------------------------------------------------- |
| `Button`        | ✅            | `button.tsx`                                                                            |
| `LearnMoreLink` | ✅            | `link.tsx`                                                                              |
| `SelectPopover` | ✅            | `select-popover.tsx`                                                                    |
| `Modal`         | ✅            | `modal.tsx`                                                                             |
| `Tab` / `Tabs`  | ✅            | `tabs.tsx`                                                                              |
| `Banner`        | ✅            | `banner.tsx`                                                                            |
| `Card`          | ✅            | `card.tsx`                                                                              |
| `Divider`       | ✅            | `divider.tsx`                                                                           |
| `Progress`      | ✅            | `progress.tsx`                                                                          |
| `Icon`          | ✅            | `icon.tsx` (re-exports `ui/components/icon`, pending consolidation — see mapping below) |

`utils/` helpers (e.g. `utils/cls.ts`, `utils/variants.ts`, `utils/index.ts`) are library-internal (tailwind-merge / tailwind-variants helpers) and are **not** re-exported from the barrel — see [`AGENTS.md`](./AGENTS.md).

## Migration mapping (old → new)

Tracks the consolidation described in the plan (Confluence). Status: 🔜 not started · 🚧 in progress · ✅ done.

| Old                                                                                                                          | New                                                    | Status                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `basic-components/button.tsx` + `ui/components/themed-button/` (9 files) + `async-button.tsx`                                | `Button` (+ loading spinner, `AsyncButton` wrapper)    | 🚧 (canonical file in `button.tsx`; consolidation pending)                |
| — (new)                                                                                                                      | `IconButton`                                           | 🔜                                                                        |
| `ui/components/icon.tsx` (38 files) + `basic-components/icon.tsx` (~10) + `ui/components/svg-icon.tsx` (70 glyphs, 13 files) | `Icon`                                                 | 🔜                                                                        |
| `ui/components/tooltip.tsx` (21) + `ui/components/help-tooltip.tsx` (26)                                                     | `Tooltip` / `HelpTooltip`                              | 🔜                                                                        |
| `ui/components/base/input.tsx`                                                                                               | `Input` / `TextField`                                  | 🔜                                                                        |
| `ui/components/base/select.tsx` + `basic-components/select-popover.tsx`                                                      | `Select`                                               | 🚧 (canonical file in `select-popover.tsx`; merge pending)                |
| `ui/components/base/modal.tsx` + `modal-header/body/footer.tsx`                                                              | `Modal` (+ `size` variant, `Modal.Header/Body/Footer`) | 🚧 (canonical file in `modal.tsx`; feature parity pending, see plan §7.6) |
| `ui/components/base/dropdown/`                                                                                               | `Menu`                                                 | 🔜                                                                        |
| — (new)                                                                                                                      | `Popover`                                              | 🔜                                                                        |
| — (new)                                                                                                                      | `ListBox` / `ListBoxItem`                              | 🔜                                                                        |
| `basic-components/tabs.tsx`                                                                                                  | `Tabs` (+ controlled/render-prop)                      | 🚧 (canonical file in `tabs.tsx`)                                         |
| `ui/components/base/checkbox.tsx`                                                                                            | `Checkbox` / `CheckboxGroup`                           | 🔜                                                                        |
| `ui/components/base/switch.tsx`                                                                                              | `Switch`                                               | 🔜                                                                        |
| `ui/components/base/input-number.tsx`                                                                                        | `NumberField`                                          | 🔜                                                                        |
| `ui/components/base/date-picker.tsx`                                                                                         | `DatePicker`                                           | 🔜                                                                        |
| `ui/components/base/middle-truncate.tsx`                                                                                     | TBD (P2 fill-in)                                       | 🔜                                                                        |
| `basic-components/link.tsx` + `ui/components/base/link.tsx`                                                                  | `Link`                                                 | 🚧 (canonical file in `link.tsx`; merge pending)                          |
| `ui/components/unsaved-changes-confirm-dialog.tsx` + guard                                                                   | `ConfirmDialog`                                        | 🔜                                                                        |
| `ui/components/editable-input.tsx`                                                                                           | `EditableInput`                                        | 🔜                                                                        |
| `ui/components/time-from-now.tsx`                                                                                            | `TimeFromNow`                                          | 🔜                                                                        |
| `basic-components/card.tsx` / `divider.tsx` / `banner.tsx` / `progress.tsx`                                                  | `Card` / `Divider` / `Banner` / `Progress`             | 🚧 (`Progress` still has hardcoded colors, see FIXME)                     |
| `ui/components/base/badge.tsx`                                                                                               | `Badge`                                                | 🔜                                                                        |

Not covered by this library (feature consumers, not generic primitives): `ui/components/tabs/`,
`ui/components/dropdowns/`.
