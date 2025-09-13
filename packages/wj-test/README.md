# WJ Test Framework

## 1. Core Design

a. **Data-Driven Testing**

Customize test data in CSV files to quickly expand the range of test scenarios.

b. **Test Case Management**

- Define test files to flexibly select test cases for execution and unify the management of test cases to run (see `Test Execution via Test File Management` for details).

- Execute test cases through the `TestRunner`.

c. **CI Integration**

d. **Test Reporting**

Generate HTML reports automatically after test execution.

e. **To-Be-Expanded Features**

- Send test result reports via email.

- Extend test files: Filter and execute test cases by test case levels and tags.

- Organize and design UI test cases using the POM (Page Object Model) pattern.

## 2. Test Data Files

a. Each row in the data file drives one test case. For example, the CSV file below will make the `TestRunner` generate three test cases in the same group:

```
id,test\_case,url,method,headers,body,expected\_status

1,GET from petstore - 200,https://petstore.swagger.io/v2/pet/100,GET,,,200

2,GET from petstore - 404,https://petstore.swagger.io/v2/pet/12345678,GET,,,404

3,httpbin - GET request,https://httpbin.org/get,GET,"User-Agent: Mozilla/5.0
```

b. Write test case logic according to standard Playwright test file conventions, and reference fields in the data file via the `record` parameter.

c. The `TestRunner` automatically matches the data file with the same name as the test file. For example:

- Test file: `http_request.test.ts`

- Corresponding data file: `http_request_data.csv`

d. If no data file is provided, the `TestRunner` will execute the test case directly.

## 3. Test Case Execution

### a. Direct Test Execution

- **Run all test cases**:

```
npm run test:build -w wj-test -- --project=WJTest
```

- **Run a single test case**:

```
npm run test:build -w wj-test -- --project=WJTest http\_request
```

You can also run tests in the workspace root directory (`packages/wj-test`):

- **Run all test cases**:

```
npx playwright test --project WJTest
```

- **Run a single test case**:

```
npx playwright test --project WJTest -- http\_request
```

### b. Test Execution via Test Files

- **Execute after compilation**:

```
npm run start:csv -w wj-test
```

- **Directly execute compiled files**:

```
npm run test:csv -w wj-test
```

#### Test File Description

The framework supports controlling test cases to execute via a CSV test file:

- **File name**: `test-config.csv`

- **CSV file format**:

```
run,path,filename <--- Field names (fixed)
yes,tests,example <--- Test case 1 to execute
yes,tests, <--- Test case 2 to execute
```

**_Field Description_**

- `run`: Specifies whether to execute the test case. Value options: `yes`|`no` (default: `yes`).

- `path`: The directory where the test cases are stored. If only `path` is specified (without `filename`), it means all test cases under the directory will be executed.

- `filename`: The name of the test case (without the `.test.ts` suffix).

## 4. CI Integration (GitHub Action)

I created a new workflow for wj-test on GitHub:

- **Workflow name**: `WJ Tests of Insomnia App`

- **Workflow file name**: `wj-test.yml`

After the "Install packages" step in this workflow, the test cases under `wj-test` will be executed. Once the tests are completed, an HTML test report will be generated, which can be viewed here:

[https://filewen.github.io/insomnia/](https://filewen.github.io/insomnia/)

## 5. File Structure

**Root path**: `packages/wj-test`

```
packages/wj-test/
├── package.json          # Node.js configuration
├── playwright.config.ts  # Playwright project configuration
├── tsconfig.json         # TypeScript compilation configuration
├── test-config.csv       # Test case execution control file
├── common/
│   ├── app.ts            # Simplified App startup logic
│   ├── paths.ts          # Path retrieval file
│   └── test-runner.ts    # Test case execution control
├── scripts/
│   └── run-csv-tests.ts  # CSV-based test case execution control
└── tests/
    ├── example.test.ts       # A simple Playwright test case (for framework validation)
    ├── simple_requests.test.ts  # Creates a simple HTTP request (no dependency on data files)
    ├── http_request.test.ts     # Data-driven HTTP request test case (matches CSV files, sends requests, and verifies responses).
    └── http_request_data.csv    # Data file for `http_request.test.ts`.
/.github/workflows/
└── wj-test.yml       # GitHub Action workflow control file.
```

## 6. Additional Notes

a. For testing convenience, I simplified some components when starting the tests:

- **Insomnia user information is not loaded**: Test cases start from "Local Scratch" to simulate a new user scenario.

- **Local Webserver is not started**: Requests point to external public APIs.

b. In the action workflow, due to a lack of permission to access `@kong/insomnia-plugin-external-vault` in my forked repository, I removed `npm run verify-bundle-plugins -w insomnia` from the `postinstall` script in `package.json`. This should be added back for official use.
