# Insomnia Playwright Test Suite

This repository contains automated tests for Insomnia's core functionality using Playwright.

## Setup Instructions

1. **Clone repository**:

git clone https://github.com/xiebohust/insomnia.git
cd insomnia/insomnia-automation-test

2. Install dependencies:
npm install

3. Run tests
# Headed mode (visible browser)
npx playwright test --headed

# Headless mode (default)
npx playwright test

# Specific test file
npx playwright test tests/main-workflow.test.ts

# Generate HTML report
npx playwright show-report



**Design Considerations**
**Approach**
Real-world simulation: Tests mimic actual user behavior with realistic pauses

Test isolation: Each test uses clean data directory

CI-ready: Includes GitHub Actions configuration

Cross-platform: Supports Windows, macOS, and Linux

**Key Features**
Main workflow test covering:

Request creation

Header configuration

Response validation

Timeline inspection

Comprehensive test reporting (HTML, JUnit)

CI pipeline integration

Automatic onboarding handling

**Trade-offs**
Test data management:

Uses real HTTP endpoints (httpbin.org) instead of mocks

Balance between realism and test stability

UI vs API testing:

Focused on UI workflows rather than lower-level API tests

Prioritizes user-facing functionality

Test coverage:

Focused on critical paths rather than edge cases

Prioritizes breadth over depth for demonstration

Potential Improvements
Add more authentication method tests

Implement visual regression testing

Add performance metrics collection

Create environment variable tests