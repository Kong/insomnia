# Insomnia Smoke Tests

This project contains the smoke testing suite for Insomnia and Inso.

Tests for the Electron app are written using [Spectron](https://github.com/electron-userland/spectron#application-api) (and [spectron-keys](https://github.com/jsantell/spectron-keys) for key inputs), while tests for the CLI use [execa](https://github.com/sindresorhus/execa).

## Structure

| Folder | Purpose |
| - | - |
| `/cli` | tests for inso |
| `/core` | tests for Insomnia |
| `/server` | Express server used by the tests |
| `/fixtures` | data used by tests and the server |
| `/modules` | logical grouping of functionality (eg. `modals` , `tabs` , `settings` , `home` ) |

## How to run

There are several ways to run a test but the first step is to bootstrap and build or package the relevant application.

From the root of this repository:

```shell
npm run bootstrap                   # Install packages and compile inso
npm run app-build:smoke             # Compile Insomnia
npm run inso-package                # Package the Inso CLI binaries
```

You can then run the smoke tests, again from the root:

```shell
npm run test:smoke:cli         # Run CLI tests
npm run test:smoke:build       # Run Insomnia tests
```

Sometimes, you might need to run tests against a _packaged_ application. A packaged application is the final artifact which bundles all of the various resources together, and is created for distribution in the form of a `.dmg` or `.exe`, etc. Packaging takes longer to do and is only required for edge cases (such as a <!-- TODO(TSCONVERSION) update this link -->[plugin installation](https://github.com/Kong/insomnia/blob/357b8f05f89fd5c07a75d8418670abe37b2882dc/packages/insomnia-smoke-test/designer/app.test.js#L36)), so we typically run tests against a build. To run packaged tests, from the root:

```shell
npm run app-package:smoke      # Package Insomnia
npm run test:smoke:package     # Run Insomnia tests
```

Each of the above commands will automatically run the Express server, so you do not need to take any extra steps.

## How to write

When writing tests, it is recommended to use the scripts in this project directly (instead of from the root, as per the section above). After building and/or packaging your application under test, it will be available under `packages/insomnia-app/{build|dist}` and you can begin writing your test.

In order to run tests for development, open two terminal tabs in `packages/insomnia-smoke-test`:

```shell
# In the first tab, serve the Express API
npm run serve

# In the second tab, run your tests
npm run cli                         # Run CLI tests
npm run spectron:build         # Insomnia build tests

npm run spectron:package       # Insomnia package tests
```

This will allow you to write and monitor the server separately from each test, speeding up the development cycle.

You may also need to run a test multiple times. You can focus a particular test or test suite using [Jest globals](https://jestjs.io/docs/en/api#testonlyname-fn-timeout) such as `it.only` and `describe.skip`, or their aliases `fit` and `xdescribe`, etc.

## General guidelines

### Data

Individual tests will automatically run against a clean Insomnia data directory to keep data isolated.

### Dependencies

A test should not depend on any external services unless absolutely necessary. If a particular endpoint is required (eg. for authentication or a specific content type), implement a new endpoint in `/server`.

### Element selection

Spectron is built heavily on top of WebdriverIO, and WebdriverIO's `browser` object is available under `app.client` ([docs](https://github.com/electron-userland/spectron#client)). This is the primary API you will need for user interactions, see examples with existing tests.

Through WebdriverIO you can use a host of CSS or React selectors. There is no clear guideline about which selector to use, but whichever approach is used it must favour stability and be understandable.

There are trade-offs with each selector approach but it's important to know how generic or specific a particular component or CSS class is, in order to ensure that the correct element is always selected as the application evolves.

#### Select by component and props

Sometimes selecting by a React component and props, directly from `app.client` is the cleanest approach, as the following two examples show:

```ts
const waitUntilRequestIsActive = async (app: Application, name: string) => {
  const request = await app.client.react$('UnconnectedSidebarRequestRow', {
    props: { isActive: true, request: { name } },
  });

  await request.waitForDisplayed();
};

export const clickFolderByName = async (app, name) => {
  const folder = await app.client.react$('UnconnectedSidebarRequestGroupRow', {
    props: { requestGroup: { name } },
  });

  await folder.waitForClickable();
  await folder.click();
};
```

You can find a list of component names in `modules/component-names.ts`.

#### Scoping

It is important to scope an element to an appropriate ancestor. In a way the selector becomes self-documenting, but also ensures stability as the UI evolves.

In the following example, it is possible for multiple buttons which match the `button#enabled` selector to exist on the page. By chaining a React and CSS selector, we can ensure the test runner will always click the expected button within the `BasicAuth` component.

```ts
export const toggleBasicAuthEnabled = async (app: Application) => {
  await app.client
    .react$('BasicAuth')
    .then(e => e.$('button#enabled'))
    .then(e => e.click());
};
```

A similar approach can be achieved through a CSS selector. In the following example, after sending a successful request, we want to detect an element containing the CSS classes `tag bg-success` and ensure it contains the text `200 OK`.

These classes are fairly generic and could exist multiple times on the page, but the HTTP response code will always be in the response pane (`response-pane`) header (`pane__header`). As such, the selector is scoped to always select the expected element, wait for it to show, and ensure it has the expected text.

```ts
export const expect200 = async (app: Application) => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-success');
  await tag.waitForDisplayed();
  await expectText(tag, '200 OK');
};
```

### Interactions

As is common with all smoke testing frameworks, before interacting with an element (click, hover, etc) it is generally good to check whether you _can_ interact with it. For instance, clicking a button will fail if the button is not yet clickable.

Sometimes you will need to add explicit pauses to allow for UI to refresh or database writes to occur (`await app.client.pause(500)`). Try to keep these to a minimum, though, exploring all other avenues first, such as WebdriverIO's `waitFor*` functions. Avoiding explicit waits ensures each test runs in the short amount of time.

When typing in the url bar for HTTP requests, we first wait for it to exist on the page before clicking on it and typing, because request activation can take some time.

```ts
export const typeInUrlBar = async (app: Application, url: string) => {
  const urlEditor = await app.client.react$('RequestUrlBar');
  await urlEditor.waitForExist();
  await urlEditor.click();
  await urlEditor.keys(url);
};
```

In addition, sometimes we want to wait for an element to hide instead of show. To achieve this, we can use the `reverse` option available through WebdriverIO, as shown in the following example.

```ts
// Wait for spinner to show
const spinner = await app.client.react$('ResponseTimer');
await spinner.waitForDisplayed();

// Wait for spinner to hide
await spinner.waitForDisplayed({ reverse: true });
```

### Readability

It is important for a smoke test to be _readable_ so the flow can be understood, and the (often complicated) implementation details hidden, like in the example below.

```ts
import * as debug from '../modules/debug';

it('sends request with basic authentication', async () => {
  const url = 'http://127.0.0.1:4010/auth/basic';
  const { latin1, utf8 } = basicAuthCreds;

  await debug.workspaceDropdownExists(app);
  await debug.createNewRequest(app, 'basic-auth');
  await debug.typeInUrlBar(app, url);

  // Send request with no auth present
  await debug.clickSendRequest(app);
  await debug.expect401(app);

  // Click auth tab
  await debug.clickRequestAuthTab(app);
  await debug.expectNoAuthSelected(app);

  // Select basic auth
  await debug.clickRequestAuthDropdown(app);
  await debug.clickBasicAuth(app);

  // Enter username and password with regular characters
  await debug.typeBasicAuthUsernameAndPassword(app, utf8.raw.user, utf8.raw.pass);

  // Send request with auth present
  await debug.clickSendRequest(app);
  await debug.expect200(app);

  const responseViewer = await debug.getResponseViewer(app);
  await debug.expectText(responseViewer, '1\nbasic auth received');
});
```

In most cases, it will be beneficial to create helper functions under `/modules`, regardless of how reusable they are. Some modules (such as `dropdown`, `tabs` and `settings`) are reusable, while some are specific to certain pages (eg `debug`, `home`, `onboarding`). These can be broken down into more granular modules as the test suite grows.

### Extend tests

Unlike unit tests, the application startup time for a smoke test can sometimes be longer than the test itself. As such, in cases where it is appropriate, **extend** a smoke test with additional steps instead of creating a **new** test.

## Working with fixtures

### How to update the inso-nedb fixture

In order to update the inso-nedb fixutre you need to launch Insomnia using the inso-nedb directory. To do this, set the INSOMNIA_DATA_PATH environment variable and launch from the command line.

#### MacOS

```bash
INSOMNIA_DATA_PATH=packages/insomnia-smoke-test/fixtures/inso-nedb /Applications/Insomnia.app/Contents/MacOS/Insomnia
```

#### Linux

TODO

#### Windows

TODO

After making your changes, be sure to relaunch the app one more time from the command line, so that Insomnia compacts the database. The .gitignore file will explicity ignore certain database files, to keep the directory size down and avoid prevent data leakage in case you are signed in to the app when launching with this database.

### How to run inso with the inso-nedb fixture locally?

Set the `--src packages/insomnia-smoke-test/fixtures/inso-nedb` flag

```bash
# if installed globally
inso --src ...

# using the package bin
./packages/insomnia-inso/bin/inso --src ...

# using a binary
./packages/insomnia-inso/binaries/insomnia-inso --src ...
```

## Contributing a smoke test?

Smoke tests can potentially be flaky, and one attempt to avoid flaky tests in the default branch is to run the final implementation of a test at least 20 times locally to prove its stability. If a test is unable to achieve this, it is very unlikely to be accepted into the test suite.

You can repeat a test quickly by wrapping it with the following block:

```ts
describe.only.each(new Array(20).fill(1))('iteration %#', _ => {
  it('your test name', () => {
    //...
  });
});
```

When raising a PR, paste a screenshot of the test results showing at least 20 successful iterations.
