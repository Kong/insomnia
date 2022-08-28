# Insomnia API Client

## Parede de Tecnologia

|Linguagem||Runtime|Monorepo|
|-|-|-|-|
|<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Unofficial_JavaScript_logo_2.svg/480px-Unofficial_JavaScript_logo_2.svg.png" alt="JS Logo" height="100"></img>|<img src="https://w7.pngwing.com/pngs/915/519/png-transparent-typescript-hd-logo-thumbnail.png" alt="TS Logo" height="100"></img>|<img src="https://cdn.icon-icons.com/icons2/2415/PNG/512/nodejs_plain_logo_icon_146409.png" alt="Nodejs Logo" height="100"></img>|<img src="https://i.ibb.co/bFFMbNZ/asdasdasdas.png" alt="Lerna Logo" height="100"></img>|

|Testes||Interface Gráfica||
|-|-|-|-|
|<img src="https://seeklogo.com/images/J/jest-logo-F9901EBBF7-seeklogo.com.png" alt="Jest Logo" height="100"></img>|<img src="https://seeklogo.com/images/M/mocha-logo-66DA231220-seeklogo.com.png" alt="Mocha Logo" height="100"></img>|<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/2300px-React-icon.svg.png" alt="React Logo" height="100"></img>|<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Electron_Software_Framework_Logo.svg/1200px-Electron_Software_Framework_Logo.svg.png" alt="Electron Logo" height="100"></img>|

|Bundler, etc.|
|-|
|<img src="https://camo.githubusercontent.com/61e102d7c605ff91efedb9d7e47c1c4a07cef59d3e1da202fd74f4772122ca4e/68747470733a2f2f766974656a732e6465762f6c6f676f2e737667" alt="Vite Logo" height="100"></img>|

---

[![Slack Channel](https://chat.insomnia.rest/badge.svg)](https://chat.insomnia.rest/)
[![license](https://img.shields.io/github/license/Kong/insomnia.svg)](https://github.com/Kong/insomnia/blob/master/LICENSE)

Insomnia is an open-source, cross-platform API client for GraphQL, REST, and gRPC.

![Insomnia API Client](https://raw.githubusercontent.com/Kong/insomnia/develop/screenshots/main.png)

## Download

Insomnia is available for Mac, Windows, and Linux and can be downloaded
from the website.

**[https://insomnia.rest/download](https://insomnia.rest/download/)**

## Bugs and Feature Requests

Have a bug or a feature request? First, read the [issue guidelines](CONTRIBUTING.md#using-the-issue-tracker) and search for existing and closed issues. If your problem or idea is not addressed yet, [please open a new issue](/issues).

For more generic product questions and feedback, join the [Slack Team](https://chat.insomnia.rest) or email [support@insomnia.rest](mailto:support@insomnia.rest)

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
npm run bootstrap

# Run Tests
npm test

# Start App with Live Reload
npm run app-start
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

Also on Linux, if Electron is failing during the bootstrap process, run the following

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

- Bootstrap: `npm run bootstrap`
- Start the compiler in watch mode: `npm run inso-start`
- Run: `./packages/insomnia-inso/bin/inso -v`

## Plugins

Search for, discover, and install plugins from the Insomnia [Plugin Hub](https://insomnia.rest/plugins/)!

## Community Projects

- [Insomnia Documenter](https://github.com/jozsefsallai/insomnia-documenter) - Generate beautiful API documentation pages using the [documenter plugin](https://insomnia.rest/plugins/insomnia-plugin-documenter) or your Insomnia export file.
- [GitHub API Spec Importer](https://github.com/swinton/github-rest-apis-for-insomnia) - A complete set of GitHub REST API route specifications that can be imported straight into Insomnia.
- [Swaggymnia](https://github.com/mlabouardy/swaggymnia) - Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.

## License

[MIT](LICENSE) &copy; [Insomnia](https://insomnia.rest)
