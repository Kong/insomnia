# Restless

[![license](https://img.shields.io/github/license/outmanos/restless.svg)](LICENSE)

Restless is an Unkonged [Insomnia](https://github.com/Kong/insomnia): an offline-first, modern and up to date API client
for GraphQL, REST, WebSockets, Server-Sent Events (SSE), gRPC and Socket.IO. It requires **no account** and has **zero telemetry**.

This fork was inspired by the original Insomnium, which was unfortunately nuked. You can read
[its backstory here](docs/insomnium/README.md).

With Restless you can:

- **Work offline** with every core feature and no login.
- **Keep your data in plain files** with `File > Open Folder…`, which stores collections as YAML in a Git repository.
  Commits, branches and history work with no remote or account.
- **Debug APIs** with OAuth 1 and 2, Digest, NTLM, AWS IAM, Hawk, Netrc, ASAP and more.
- **Design APIs** with the OpenAPI editor, visual preview and Spectral linting.
- **Test APIs** with scripts, test suites and the collection runner.
- **Mock APIs** with a self-hosted mock server.
- **Build CI/CD pipelines** with the `rl` CLI.
- **Extend it** with plugins and themes.

Everything that needs an outside service is off until you enable it:

- **GitHub and GitLab sign-in**, using your own OAuth apps. Access tokens work without it.
- **AI features and the MCP client**, using your own API key or a local server.
- **Secret managers**: HashiCorp Vault, AWS Secrets Manager and GCP Secret Manager.

The goal is to be feature complete with both Insomnia and Bruno. Guides are in the [wiki](https://github.com/outmanos/restless/wiki), and progress is tracked in the [roadmap](ROADMAP.md).

Restless is an independent fork under the Apache-2.0 license and is not affiliated with Kong.

## Install

Download the latest version from [GitHub Releases](https://github.com/outmanos/restless/releases/latest).

| Platform                | Download                  |
| ----------------------- | ------------------------- |
| Windows                 | `.exe` installer          |
| macOS (Apple Silicon)   | `.dmg`                    |
| Any Linux               | `.AppImage` or `.tar.gz`  |
| Debian, Ubuntu, Mint    | `.deb`                    |
| Fedora, RHEL, openSUSE  | `.rpm`                    |

Windows and macOS builds are not signed yet, so you may see a warning on first launch.

The AUR, winget, Homebrew, Flathub and Snap are planned.

## Bugs and Feature Requests

Have a bug or a feature request? First, read the
[issue guidelines](CONTRIBUTING.md#using-the-issue-tracker) and search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/outmanos/restless/issues).


## Contributing

Please read through our [contributing guidelines](CONTRIBUTING.md) and [Kind Communication Guidelines](CODE_OF_CONDUCT.md). Included are directions for opening issues, coding standards, and notes on development.

## Develop Restless

Development on Restless can be done on Mac, Windows, or Linux as long as you have [Node.js](https://nodejs.org) and [Git](https://git-scm.com/). See the `.nvmrc` file located in the project for the correct Node version.

<details>
<summary>Initial Dev Setup</summary>

This repository is structured as a monorepo and contains many Node.JS packages. Each package has its own set of commands, but the most common commands are available from the root [`package.json`](package.json) and can be accessed using the `npm run …` command. Here are the only three commands you should need to start developing on the app.

```shell
# Install and Link Dependencies
npm i

# Run Lint
npm run lint

# Run type checking
npm run type-check

# Run Tests
npm test

# Start App with Live Reload
npm run dev

# Start App with both renderer process live reload and main process auto restart
npm run dev:autoRestart
```

### Linux

If you are on Linux, you may need to install the following supporting packages:

<details>
<summary>Ubuntu/Debian</summary>

```shell
# Update library
sudo apt-get update

# Install font configuration library & support
sudo apt-get install libfontconfig-dev
```

</details>

<details>
<summary>Arch Linux</summary>

```shell
# Install build tools, libcurl and font configuration library
sudo pacman -S --needed base-devel curl fontconfig
```

</details>

<details>
<summary>Fedora</summary>

```shell
# Install libcurl for node-libcurl
sudo dnf install libcurl-devel
```

</details>

Also on Linux, if Electron is failing during the install process, run the following

```shell
# Clear Electron install conflicts
rm -rf ~/.cache/electron
```

### Windows

If you are on Windows and have problems, you may need to install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools)

</details>

<details>
<summary>Editor Requirements</summary>

You can use any editor you'd like, but make sure to have support/plugins for the following tools:

- [ESLint](http://eslint.org/) - For catching syntax problems and common errors
- [JSX Syntax](https://facebook.github.io/react/docs/jsx-in-depth.html) - For React components

</details>

## Develop the CLI

- `npm i`
- Start the compiler in watch mode: `npm run inso-start`
- Run: `./packages/insomnia-inso/bin/inso -v`

## Plugins

Restless loads Insomnia plugins. Install one by its npm package name in `Preferences > Plugins`.

## License

[Apache-2.0](LICENSE)
