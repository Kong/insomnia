# Insomnia API Client

[![Slack Channel](https://chat.insomnia.rest/badge.svg)](https://chat.insomnia.rest/)
[![license](https://img.shields.io/github/license/Kong/insomnia.svg)](LICENSE)

Insomnia is an open-source, cross-platform API client for GraphQL, REST, WebSockets, Server-sent events (SSE), gRPC and any other HTTP compatible protocol.

With Insomnia you can:

- **Debug APIs** using the most popular protocols and formats.
- **Design APIs** using the native OpenAPI editor and visual preview.
- **Test APIs** using native test suites.
- **Mock APIs** using a server and routes.
- **Build CI/CD pipelines** using the native Insomnia CLI for linting and testing.
- **Collaborate with others** using the many collaboration features to share your projects.

And a lot more! The following storage options are supported for your projects, collections, specs and all other files:

- **Local Vault**: for local storage of collections, design specs and every other resource.
- **Cloud Sync**: for cloud collaboration, encrypted and free.
- **Git Sync**: for Git storage of all files using any 3rd party Git repository.

![Insomnia API Client](https://raw.githubusercontent.com/Kong/insomnia/develop/screenshots/main.png)

## Get started

Insomnia is available for Mac, Windows, and Linux and can be downloaded from the website:

**[https://insomnia.rest/download](https://insomnia.rest/download/)**

## Account & Subscriptions

You can use Insomnia without an account with **Scratch Pad**, or you can [create an account for free](https://insomnia.rest/pricing) to get access to the full capabilities of the product.

Even with an account, Insomnia only stores your projects and files accordingly to the storage backend that you have selected, which can be Local Vault, Cloud Sync, Git Sync or any combination of them. As such you have
the freedom to choose to store sensitive projects locally, while still being able to collaborate on others in the cloud or on Git. It's the best of both worlds.

## Premium features and support

Kong Inc. offers commercial subscriptions that enhance Insomnia in a variety of ways. Some of those features include the ability to create organizations for your projects, Enterprise SSO with SAML and OIDC, RBAC when sharing
our projects with others, AI capabilities to increase developer productivity when creating, testing and documenting APIs and a lot more.

You can [explore all premium plans](https://insomnia.rest/pricing) and get started for free.

## Bugs and Feature Requests

Have a bug or a feature request? First, read the
[issue guidelines](CONTRIBUTING.md#using-the-issue-tracker) and search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](https://github.com/Kong/insomnia/issues).

For more generic product questions and feedback, join the [Slack Team](https://chat.insomnia.rest).

## Contributing

Please read through our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md). Included are directions for opening issues, coding standards, and notes on development.

## Documentation

Check out our open-source [Insomnia Documentation](https://docs.insomnia.rest/).

## Develop Insomnia

Development on Insomnia can be done on Mac, Windows, or Linux as long as you have [Node.js](https://nodejs.org) and [Git](https://git-scm.com/). See the `.nvmrc` file located in the project for the correct Node version.

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

## Develop Inso CLI

- `npm i`
- Start the compiler in watch mode: `npm run inso-start`
- Run: `./packages/insomnia-inso/bin/inso -v`

## Plugins

Search for, discover, and install plugins from the Insomnia [Plugin Hub](https://insomnia.rest/plugins/)!

## Community Projects

- [Insomnia Documenter](https://github.com/jozsefsallai/insomnia-documenter) - Generate beautiful API documentation pages using the [documenter plugin](https://insomnia.rest/plugins/insomnia-plugin-documenter) or your Insomnia export file.
- [GitHub API Spec Importer](https://github.com/swinton/github-rest-apis-for-insomnia) - A complete set of GitHub REST API route specifications that can be imported straight into Insomnia.
- [Swaggymnia](https://github.com/mlabouardy/swaggymnia) - Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.

## License

[Apache-2.0](LICENSE) &copy; [Insomnia](https://insomnia.rest)
