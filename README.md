# Insomnia REST Client 

[![Insomnia](https://img.shields.io/badge/maintainer-Insomnia-purple.svg?colorB=6e60cc)](https://insomnia.rest)
[![Travis](https://api.travis-ci.org/getinsomnia/insomnia.svg)](https://travis-ci.org/getinsomnia/insomnia)
[![Slack Channel](https://chat.insomnia.rest/badge.svg)](https://chat.insomnia.rest/)
[![Twitter Follow](https://img.shields.io/twitter/follow/getinsomnia.svg?style=social&label=%40GetInsomnia%20on%20Twitter&style=plastic)](https://twitter.com/getinsomnia)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/getinsomnia/insomnia/master/LICENSE)

Insomnia is a cross-platform _REST client_, built on top of [Electron](http://electron.atom.io/).

![Insomnia REST Client Screenshot](https://raw.githubusercontent.com/getinsomnia/insomnia/master/screenshots/main.png)

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

Editor preferences are available in the [editor config](.editorconfig) for easy use in 
common text editors. Read more and download plugins at [editorconfig.org](http://editorconfig.org).

## Developing

Development on Insomnia can be done on Mac, Windows, or Linux as long as you have
[NodeJS 8](https://nodejs.org) and [Git](https://git-scm.com/).

<details>
<summary>Initial Dev Setup</summary>

This repository is structured as a monorepo and contains many Node.JS packages. Each package has
it's own set of command, but the most common commands are available from the 
root `[package.json](package.json)` adn can be accessed using the `npm run ...` command. Here
are the only three commands you should need to start developing on the app.

```bash
# Install and Link Dependencies
npm run bootstrap

# Run Tests
npm test

# Start App with Live Reload
npm run app-start
```

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

Here is a list of plugins available for installation via NPM.

- [Custom Timestamp](https://www.npmjs.com/package/insomnia-plugin-customtimestamp) – Advanced timestamp creator
- [Default Headers](https://www.npmjs.com/package/insomnia-plugin-default-headers) – Set default headers on requests
- [OS Util](https://www.npmjs.com/package/insomnia-plugin-os) – Get OS information
- [JWT Decode](https://www.npmjs.com/package/insomnia-plugin-jwtdecode) – Decode header or payload of JWT tokens
- [XDebug](https://www.npmjs.com/package/insomna-plugin-xdebug) – Enable Xdebug debugging by adding an `XDEBUG_SESSION` cookie to the request.
- [Random Number](https://www.npmjs.com/package/insomnia-plugin-randomnumber) – Generate a random integer between a minimum and maximum
- [Chance](https://www.npmjs.com/package/insomnia-plugin-chance) – Generates a random value using Chance.JS
- [Random Credit Card](https://www.npmjs.com/package/insomnia-plugin-randomcreditcard) – Generate random credit card numbers
- [Random UK Sort Code](https://www.npmjs.com/package/insomnia-plugin-randomuksortcode) – Generate random UK bank sort codes

## Community Projects

[Swaggymnia](https://github.com/mlabouardy/swaggymnia) – Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.

## License

[MIT](LICENSE) &copy; [Insomnia](https://insomnia.rest)
