# main-workflow.test.ts Documentation

This file is located in the `packages/insomnia-smoke-test/tests/smoke/` directory and is written using the [Playwright](https://playwright.dev/) framework. It is mainly used for automated testing of the main workflow of the Insomnia application. The tests cover request creation, sending, response validation, and various common scenarios.

## Main Test Scenarios

1. **Main Workflow: Create, Send, and Validate Request**
   - Open the app and ensure the main interface is loaded.
   - Create a new request collection, set the request body to JSON, fill in the URL, and send the request.
   - Validate the response status code and body content.

2. **Request with Cookie**
   - Create a request collection and fill in the URL.
   - Open the Cookie editor, add and edit a cookie.
   - Send the request and verify the cookie is sent with the request.

3. **Error Prompt for Missing URL**
   - Create a request but leave the URL empty, then send it.
   - Check if the application correctly prompts a "No URL set" error.

4. **Request with Basic Authentication**
   - Create a request collection and fill in the URL.
   - Set Basic Auth credentials.
   - Send the request and verify the request header contains the correct authentication information.

5. **Switch Environment and Send Request**
   - Create a request collection, enter environment management, and edit environment variables (e.g., base_url).
   - Use the environment variable in the request and send it.
   - Verify the request correctly uses the environment variable.

## Dependencies and Prerequisites

- Depends on the Playwright testing framework.
- Requires a local mock service to be available (e.g., http://127.0.0.1:4010/echo).
- Should be run in the Insomnia application development environment.

## How to Run

In the root directory of `insomnia-develop`, run the smoke tests with:

```bash
npm run test:smoke:build -- main-workflow.test.ts --reporter=html
```

Or run according to the actual Playwright configuration of the project.

## Scope

This file is intended for end-to-end automated regression testing of the main workflow of the Insomnia desktop application, facilitating continuous integration and pre-release validation.

---

To extend test scenarios, refer to the structure of existing cases and add more interaction steps and assertions as needed.
