Prerequisites:
- Clone the project
- Run `npm install`

As the Electron app launch takes time on my local machine(usually 3.8 minutes) when I tried the test scripts, the test was only executed successfully in debug mode for local run. It's better to have the Playwright VS Code extension installed.

Below are info copied from packages/insomnia-smoke-test/README.md:

--- copied from packages/insomnia-smoke-test/README.md -----
- Install the [Playwright extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).
- With the extension installed, run on terminal `npm run watch:app`.

You can trigger tests from the `Testing` tab, or within the test files clicking the run button. Or step through the test with playwright inspector : 'PWDEBUG=1 npm run test:e2e:dev'

After the test completes, run 'npm run test:report' to generate the HTML report locally. The report will be opened automatically or you can try access http://localhost:9323/ to check it.
