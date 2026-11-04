# Migrating from Insomnia

One-click migration is the next priority on the [Roadmap](Roadmap). Until then, move your data by hand.

1. In Insomnia, export your data to a file.
2. In Restless, open a project, choose **Import**, and pick that file.

Current YAML exports and older Insomnia formats are both supported.

## Git projects

Use `File > Open Folder…` on the repository. Restless reads the Insomnia YAML files in it directly.

## What doesn't move

- Cloud Sync projects must be exported from Insomnia first.
- Saved passwords and tokens may need entering again.
- Installed plugins must be reinstalled.

Restless uses its own data folder, so it never changes an Insomnia install.
