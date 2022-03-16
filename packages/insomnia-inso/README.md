<!-- markdownlint-disable heading-style first-line-h1 -->
<!-- markdownlint-disable no-inline-html  -->
<div align="center">
  <br />
  <br />
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/logo.svg" alt=""/>
  <h1>
    Inso CLI
    <br />
    <br />
  </h1>
  <h3>A CLI for <a href="https://insomnia.rest">Insomnia</a></h3>
  <pre>npm install --global <a href="https://www.npmjs.com/package/insomnia-inso">insomnia-inso</a></pre>
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/demo.gif" alt=""/>
  <br />
</div>
<br />
<!-- markdownlint-enable no-inline-html  -->

## Documentation

See the [open-source Inso CLI documentation](https://docs.insomnia.rest/inso-cli/introduction).

## Run api test in watch mode

This is helpful for debugging failing api tests and altering the send-request abstraction

From project root, in seperate terminals:

```sh
# start smoke test api
npx lerna --scope insomnia-smoke-test exec 'npm run serve'
# watch send-request
npx lerna --scope insomnia-app exec 'npm run build:sr -- --watch'
# watch inso
npx lerna --scope insomnia-inso exec 'npm run start'
# run api test
$PWD/packages/insomnia-inso/bin/inso run test "Echo Test Suite" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose
```
