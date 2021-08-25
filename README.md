# Insomnia REST Client

[![Slack Channel](https://chat.insomnia.rest/badge.svg)](https://chat.insomnia.rest/)
[![license](https://img.shields.io/github/license/Kong/insomnia.svg)](https://github.com/Kong/insomnia/blob/master/LICENSE)

Insomnia is a cross-platform _REST client_, built on top of [Electron](http://electron.atom.io/).

![Insomnia REST Client Screenshot](https://raw.githubusercontent.com/Kong/insomnia/develop/screenshots/main.png)

## Download

Insomnia is available for Mac, Windows, and Linux and can be downloaded
from the website.

**[https://insomnia.rest/download](https://insomnia.rest/download/)**

## Bugs and Feature Requests

Have a bug or a feature request? First, read the
[issue guidelines](CONTRIBUTING.md#using-the-issue-tracker) and search for existing and
closed issues. If your problem or idea is not addressed yet, [please open a new issue](/issues).

For more generic product questions and feedback, join the [Slack Team](https://chat.insomnia.rest) or email
[support@insomnia.rest](mailto:support@insomnia.rest)

## Contributing

Please read through our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md). Included are directions
for opening issues, coding standards, and notes on development.

## Developing

Development on Insomnia can be done on Mac, Windows, or Linux as long as you have
[Node.js](https://nodejs.org) and [Git](https://git-scm.com/). See the `.nvmrc` file located in the project for the correct Node version.

<details>
<summary>Initial Dev Setup</summary>

This repository is structured as a monorepo and contains many Node.JS packages. Each package has
its own set of commands, but the most common commands are available from the
root [`package.json`](package.json) and can be accessed using the `npm run ...` command. Here
are the only three commands you should need to start developing on the app.

```bash
# Install and Link Dependencies
npm run bootstrap

# Run Tests
npm test

# Start App with Live Reload
npm run app-start
```

If you are on Linux, you may need to install the following supporting packages 

```bash
# Update library
sudo apt-get update

# Install font configuration library & support
sudo apt-get install libfontconfig-dev
sudo apt-get install font-manager

# Build capability for required font-scanner package
sudo apt-get install build-essential
```

Also on Linux, if Electron is failing during the bootstrap process, run the following
```bash
# Clear Electron install conflicts
rm -rf ~/.cache/electron
```

If you are on Windows and have problems, you may need to install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools)

</details>

<details>
<summary>Editor Requirements</summary>

You can use any editor you'd like, but make sure to have support/plugins for
the following tools:

- [ESLint](http://eslint.org/) – For catching syntax problems and common errors
- [JSX Syntax](https://facebook.github.io/react/docs/jsx-in-depth.html) – For React components
- [Flow](https://flow.org/) – For type annotations

</details>

## Plugins

Search, discover, and install plugins from the Insomnia [Plugin Hub](https://insomnia.rest/plugins/)!

## Community Projects

- [Insomnia Documenter](https://github.com/jozsefsallai/insomnia-documenter) – Generate beautiful API documentation pages using the [documenter plugin](https://insomnia.rest/plugins/insomnia-plugin-documenter) or your Insomnia export file.
- [GitHub API Spec Importer](https://github.com/swinton/github-rest-apis-for-insomnia) – A complete set of GitHub REST API route specifications that can be imported straight into Insomnia.
- [Swaggymnia](https://github.com/mlabouardy/swaggymnia) – Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.

## License

[MIT](LICENSE) &copy; [Insomnia](https://insomnia.rest)
