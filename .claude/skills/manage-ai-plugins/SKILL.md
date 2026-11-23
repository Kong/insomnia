---
name: manage-ai-plugins
description: 'Add, change or version the AI plugins (Claude Code and Codex) shipped from the plugins/ folder. Use when adding a plugin or skill, bumping a plugin version, editing plugin metadata, or fixing the "AI plugin manifests are out of date" / plugin validation failures in the Test App workflow.'
argument-hint: 'Describe the plugin change, or provide the failing ValidatePlugins job log'
---

# Manage AI plugins

## Layout

- `plugins/plugins.json` is the single source of truth for marketplace and plugin metadata (name, version, description, keywords, Codex interface text). The owner and license come from the root `package.json`.
- `plugins/<name>/skills/<skill>/SKILL.md` holds the hand-written skills. The generator does not touch them.
- These files are **generated, never edit them by hand**:
  - `.claude-plugin/marketplace.json` (Claude Code marketplace, must stay in the repo root)
  - `.agents/plugins/marketplace.json` (Codex marketplace, must stay in the repo root)
  - `plugins/<name>/.claude-plugin/plugin.json`
  - `plugins/<name>/.codex-plugin/plugin.json`
- Generator: `scripts/plugins/generate-manifests.mjs`.

## Change metadata or bump a version

1. Edit `plugins/plugins.json`.
2. From the repo root run `npm run generate:plugins`.
3. Commit `plugins/plugins.json` together with the regenerated files.

Bump `version` whenever a skill's behavior changes, so installed copies update.

## Add a skill to an existing plugin

1. Create `plugins/<name>/skills/<skill>/SKILL.md` with `name` and `description` frontmatter. Keep the `description` specific about when to use the skill.
2. If the plugin's capabilities changed, update `codex.capabilities` and `codex.defaultPrompt` in `plugins/plugins.json`, then regenerate.
3. Bump the version (see above).

## Add a new plugin

1. Add an entry to `plugins[]` in `plugins/plugins.json` (`name`, `version`, `description`, `keywords`, and the `codex` block).
2. Create `plugins/<name>/skills/` with at least one skill.
3. Run the generator and commit everything it wrote.

## Verify

- Run the generator again and confirm `git diff` shows no further changes (this is what CI checks).
- Optionally run the same validation as CI: `claude plugin validate .` and `claude plugin validate plugins/<name>/`. CI pins `@anthropic-ai/claude-code` and `@openai/codex` in the `ValidatePlugins` job of `.github/workflows/test.yml`, so use those versions when reproducing a failure.

## CI failures

The `ValidatePlugins` job in `.github/workflows/test.yml` does two things:

1. **"AI plugin manifests are up to date"** fails when generated files differ from the source. Run the generator and commit the result.
2. **"Validate AI plugins"** runs `claude plugin validate` on the marketplace and each plugin, then adds the Codex marketplace and installs each plugin from a throwaway `CODEX_HOME`. A failure here usually means an invalid field in `plugins/plugins.json` or a missing `skills/` folder or `SKILL.md`.

## Notes

- Do not move the root marketplace files: both tools look for them at a fixed path in the repo root.
- The owner comes from the `author` field of the root `package.json` (`Name <email>` form), and the license from its `license` field.
