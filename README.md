# Insomnia REST Client 

[![Insomnia](https://img.shields.io/badge/maintainer-Insomnia-purple.svg?colorB=6e60cc)](https://insomnia.rest)
[![Travis](https://api.travis-ci.org/getinsomnia/insomnia.svg)](https://travis-ci.org/getinsomnia/insomnia)
[![AppVeyor](https://img.shields.io/appveyor/ci/gschier/insomnia.svg)](https://ci.appveyor.com/project/gschier/insomnia)
[![license](https://img.shields.io/github/license/getinsomnia/insomnia.svg)](LICENSE)
[![Slack Channel](https://chat.insomnia.rest/badge.svg)](https://chat.insomnia.rest/)
[![Twitter Follow](https://img.shields.io/twitter/follow/getinsomnia.svg?style=social&label=%40GetInsomnia%20on%20Twitter&style=plastic)](https://twitter.com/getinsomnia)

Insomnia is a cross-platform _REST client_, built on top of [Electron](http://electron.atom.io/).

![Insomnia REST Client Screenshot](https://insomnia.rest/images/docs/promo.png)

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

Please read through our [contributing guidelines](CONTRIBUTING.md). Included are directions 
for opening issues, coding standards, and notes on development.

Editor preferences are available in the [editor config](.editorconfig) for easy use in 
common text editors. Read more and download plugins at [editorconfig.org](http://editorconfig.org).

## Developing

Development on Insomnia can be done on Mac, Windows, or Linux as long as you have
[NodeJS 8](https://nodejs.org) and [Git](https://git-scm.com/).

<details>
<summary>Initial Dev Setup</summary>

```bash
# Install dependencies and build add-ons for Electron
npm install
npm run rebuild

# Start app
npm run dev

# Run tests
npm test
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

## Community Projects

- [Swaggymnia](https://github.com/mlabouardy/swaggymnia) – Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.
- [JWT Decode](https://www.npmjs.com/package/insomnia-plugin-jwtdecode) – Plugin to decode header or payload of JWT tokens
- [XDebug](https://www.npmjs.com/package/insomna-plugin-xdebug) – Plugin to enable Xdebug debugging by adding an `XDEBUG_SESSION` cookie to the request.

## License

[GNU AGPLv3](LICENSE) &copy; [Insomnia](https://insomnia.rest)
