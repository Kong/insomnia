# Distribution

Every outlet starts from a GitHub Release. Status is tracked on the [Roadmap](Roadmap).

| Outlet | Account needed | How it updates | Status |
|---|---|---|---|
| GitHub Releases | None | `release.yml` | Ready |
| AUR | AUR account and SSH key | `release.yml`, once enabled | Package ready, registration is closed |
| winget | GitHub | Workflow opens a pull request | Planned |
| Homebrew tap | GitHub | Workflow updates `outmanos/homebrew-tap` | Planned |
| Flathub | GitHub | Their bot opens pull requests | Planned |
| Snap Store | Ubuntu One | Credential in a GitHub secret | Planned |
| Nixpkgs | GitHub | Their update bot | Planned |
| Scoop | GitHub | Own bucket repository | Planned |
| Chocolatey | Chocolatey account | Workflow push, then moderation | Planned |
| apt and dnf | Cloudsmith or Packagecloud | Workflow upload | Planned |
| npm | npm account | Workflow publishes `restless-cli` | Planned |

## Enabling the AUR

1. Create an AUR account and add an SSH key.
2. Add the private key as the `AUR_SSH_PRIVATE_KEY` secret.
3. Set the `PUBLISH_AUR` variable to `true`.

The package files are in `packaging/aur`.

## Signing

- **macOS:** notarization needs an Apple Developer account. Homebrew's official cask repository will need it too.
- **Windows:** a certificate removes SmartScreen warnings.

## Homebrew

The official `homebrew-cask` repository has a popularity bar for self-submitted projects, so start with your own tap.
