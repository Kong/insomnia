# Playwright POM Conventions

This directory contains the Insomnia smoke-test Page Object Model (POM).
The goal is to keep tests stable, readable, and selector-safe.

## 1. Object Definitions

- `InsomniaApp`: root facade. It wires page objects and shared components.
- `Page` object: route-level surface (for example, project page).
- `Component` object: reusable or bounded UI region (for example, statusbar, tabbar, sidebar).

## 2. Page vs Component Split

- Put route-specific workflows in a `Page` object.
- Put reusable or independently testable UI regions in a `Component`.
- A `Page` composes its own components.
- `InsomniaApp` composes top-level pages/components and exposes shortcuts.
- Tests should use POM APIs first. Raw `page.getBy...` is only acceptable for gaps that are not modeled yet.

## 3. Locator Ownership and Naming

- Every page/component must have its own `root` getter.
- Every POM must manage all locators used by its own actions.
- Use `xxxLocator(...)` method naming when the locator needs parameters (for example, list row by name).
- For a single fixed element (for example, `root`, `plusButton`), expose it as a getter directly.
- Scope locators from `root` whenever possible to reduce collisions.
- If a locator belongs to an existing POM, tests should not duplicate that selector.

## 4. API Naming

- Action methods use verb-first names: `closeTab`, `openAddTabMenu`.
- POM exposes actions and locators; assertions stay in test files.
- Keep methods focused on one behavior.

## 5. Test Usage Pattern

Instantiate once per test and use composed objects:

```ts
test('example test', async ({ insomnia }) => {
  await insomnia.projectPage.createCollection();
  await insomnia.tabbar.closeTab('New Request');
  await expect.soft(insomnia.tabbar.tabLocator('foo')).toHaveAttribute('data-selected', 'true');
});
```
