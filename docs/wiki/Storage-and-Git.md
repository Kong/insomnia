# Storage and Git

Restless has two project types.

| Type | Where data lives | Best for |
|---|---|---|
| **Local Vault** | App database on this machine | Quick, private work |
| **Git Sync** | YAML files in a folder you choose | Version control and sharing |

## Local Git

`File > Open Folder…` opens any folder as a Git project.

- If the folder isn't a Git repository, Restless runs `git init` there.
- Existing Restless or Insomnia YAML files are imported.
- Collections are saved as plain YAML, so they work with normal Git tools.
- Commits, branches and history work with no remote and no account.
- Restless asks you to confirm you trust a folder, because collections can contain scripts.

## Commit identity

Restless uses the first identity it finds:

1. The credential on the project
2. `user.name` and `user.email` in the repository's own config
3. Your global Git config
4. Your system username

It does not write the fallback into your Git config.

## Remotes

Add a remote with an access token in `Preferences > Credentials`. See [Optional Services](Optional-Services#github-and-gitlab-sign-in) for sign-in.

## File format

Collections use the Insomnia v5 YAML format, including its `collection.insomnia.rest/5.0` type. It is a format identifier, so Restless makes no connection to that address. Keeping it means files stay compatible with Insomnia.
