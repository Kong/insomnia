# Releasing

Merging to `main` releases automatically, when the version has changed.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Released code |
| `develop` | Next release |
| Feature branches | Pull requests into `develop` |

## Make a release

1. Set the new version in `packages/insomnia/package.json`.
2. Open a pull request from `develop` to `main`.
3. Merge it.

The `Release` workflow then:

1. Reads the version, and stops if a tag for it already exists.
2. Builds for Linux, Windows and macOS.
3. Creates the tag and GitHub Release from whichever platforms built.
4. Publishes to the AUR, when enabled.

Merging without a version change publishes nothing, so `main` can receive fixes to docs or CI.

## Updates

The app checks GitHub Releases through `electron-updater`, using the `latest*.yml` files in each release.

## Signing

Builds are unsigned for now. See [Distribution](Distribution).
