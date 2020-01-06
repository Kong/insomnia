# Kong Studio

Studio is a spec-first API development app built in top of [Insomnia](https://github.com/getinsomnia/insomnia).

![Kong Studio Screenshot](https://user-images.githubusercontent.com/587576/62305922-dbd30800-b44e-11e9-8de6-ea8bdcb8d93b.png)

```shell
npm run bootstrap
npm run app-start
```

<<<<<<< HEAD
## Creating Releases

1. Bump version number in `packages/insomnia-app/package.json` `app.version` property.
2. Commit changes into Git
3. Create git tag to match version `git tag v1.0.0`
4. Push tags `git push --tags`
5. GitHub action will automatically on tags and test/build/package the app into a
   [GitHub Release](https://github.com/kong/studio/releases/)
   
   
## Merging Insomnia Changes

1. Add git remote called `insomnia` that points to Insomnia repo
2. Pull Insomnia changes with `git pull --no-tags insomnia develop`
3. Fix conflicts if any occur
4. Push merged changes to Studio
=======
If you are on Linux and have problems, you may need to install `libfontconfig-dev`

```bash
# Install libfontconfig-dev
sudo apt-get install libfontconfig-dev
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

Here is a list of plugins available for installation via NPM.

- [AWS IAM](https://www.npmjs.com/package/insomnia-plugin-aws-iam) – Template tag to retrieve system AWS credentials
- [Chance](https://www.npmjs.com/package/insomnia-plugin-chance) – Generates a random value using Chance.JS
- [Cuid](https://www.npmjs.com/package/insomnia-plugin-cuid) – Generate random cuids
- [Custom Timestamp](https://www.npmjs.com/package/insomnia-plugin-customtimestamp) – Advanced timestamp creator
- [Default Headers](https://www.npmjs.com/package/insomnia-plugin-default-headers) – Set default headers on requests
- [Defaults](https://www.npmjs.com/package/insomnia-plugin-defaults) - Set request defaults through your environment
- [Faker](https://www.npmjs.com/package/insomnia-plugin-faker) - Generate Faker data right within Insomnia!
- [Github Apps](https://www.npmjs.com/package/insomnia-plugin-github-apps-helper) – Generates a JWT for auth with the GitHub API as your GitHub App
- [Javascript Eval](https://www.npmjs.com/package/insomnia-plugin-js-eval) - Evaluate/run Javascript code
- [JWT Decode](https://www.npmjs.com/package/insomnia-plugin-jwtdecode) – Decode header or payload of JWT tokens
- [OS Util](https://www.npmjs.com/package/insomnia-plugin-os) – Get OS information
- [Random Credit Card](https://www.npmjs.com/package/insomnia-plugin-randomcreditcard) – Generate random credit card numbers
- [Random Number](https://www.npmjs.com/package/insomnia-plugin-randomnumber) – Generate a random integer between a minimum and maximum
- [Random UK Sort Code](https://www.npmjs.com/package/insomnia-plugin-randomuksortcode) – Generate random UK bank sort codes
- [Regex](https://www.npmjs.com/package/insomnia-plugin-regex) – Extract a value from an environment variable using a regular expression
- [Swagger Validator](https://www.npmjs.com/package/insomnia-plugin-validator) – Validate an API response to a swagger spec
- [XDebug](https://www.npmjs.com/package/insomnia-plugin-xdebug) – Enable Xdebug debugging by adding an `XDEBUG_SESSION` cookie to the request

## Community Projects

- [Insomnia Documenter](https://github.com/jozsefsallai/insomnia-documenter) – Generate beautiful API documentation pages using your Insomnia export file.
- [GitHub API Spec Importer](https://github.com/swinton/github-rest-apis-for-insomnia) – A complete set of GitHub REST API route specifications that can be imported straight into Insomnia
- [Swaggymnia](https://github.com/mlabouardy/swaggymnia) – Generate [Swagger](https://swagger.io/) documentation for your existing API in Insomnia.

## License

[MIT](LICENSE) &copy; [Insomnia](https://insomnia.rest)
>>>>>>> 1a6bdad51766de37692c99761359b607aa863fb4
