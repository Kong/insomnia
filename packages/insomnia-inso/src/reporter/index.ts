import pc from 'picocolors';

import { type RequestTestResult } from '../../../insomnia-scripting-environment/src/objects';

export const reporterTypes = ['dot', 'list', 'min', 'progress', 'spec', 'tap'] as const;
export type TestReporter = (typeof reporterTypes)[number];

const countTestResults = (testResults: RequestTestResult[]) => {
  const total = testResults.length;
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = total - passed;
  return { total, passed, failed };
};

function convertToTAP(testCases: RequestTestResult[]): string {
  let tapOutput = 'TAP version 13\n';
  const totalTests = testCases.length;
  // Add the number of test cases
  tapOutput += `1..${totalTests}\n`;
  // Iterate through each test case and format it in TAP
  testCases.forEach((test, index) => {
    const testNumber = index + 1;
    const testStatus = test.status === 'passed' ? 'ok' : 'not ok';
    tapOutput += `${testStatus} ${testNumber} - ${test.testCase}\n`;
  });
  return tapOutput;
}

const formatSummaryLine = ({
  title,
  total,
  passed,
  failed,
}: {
  title: string;
  total: number;
  passed: number;
  failed: number;
}) => {
  const passedText = passed ? `${pc.green(pc.bold(`${passed} passed`))}, ` : '';
  const failedText = failed ? `${pc.red(pc.bold(`${failed} failed`))}, ` : '';
  const totalText = total ? `${total} total` : '';
  return `${pc.bold(title)} ${failedText}${passedText}${totalText}`;
};

export const logTestResult = (
  reporter: TestReporter,
  testResults?: RequestTestResult[],
  log: typeof console.log = console.log,
) => {
  if (!testResults || testResults.length === 0) {
    return;
  }
  const fallbackReporter = testResults.map(r => `${r.status === 'passed' ? '✅' : '❌'} ${r.testCase}`).join('\n');
  const reporterMap = {
    dot: testResults.map(r => (r.status === 'passed' ? '.' : 'F')).join(''),
    list: fallbackReporter,
    min: ' ',
    progress: `[${testResults.map(r => (r.status === 'passed' ? '-' : 'x')).join('')}]`,
    spec: fallbackReporter,
    tap: convertToTAP(testResults),
  };

  const { total, passed, failed } = countTestResults(testResults);

  const summary = `

${formatSummaryLine({ title: 'Test:', total, passed, failed })}

${testResults
  .filter(r => r.status === 'failed')
  .map(r => r.errorMessage)
  .join('\n')}`;

  const output = `
Test results:
${reporterMap[reporter] || fallbackReporter}${summary}`;

  log(output);
};

export const logTestResultSummary = (testResultsList: RequestTestResult[][], log: typeof console.log = console.log) => {
  if (!testResultsList.length) {
    return;
  }

  const totalRequestCount = testResultsList.length;
  let failedRequestCount = 0,
    totalTestCount = 0,
    failedTestCount = 0;

  testResultsList.forEach(testResults => {
    const { total, failed } = countTestResults(testResults);

    totalTestCount += total;
    failedTestCount += failed;
    if (failed > 0) {
      failedRequestCount++;
    }
  });

  const passedTestCount = totalTestCount - failedTestCount;
  const passedRequestCount = totalRequestCount - failedRequestCount;

  const summary = `
${formatSummaryLine({ title: 'Test Requests:', total: totalRequestCount, passed: passedRequestCount, failed: failedRequestCount })}
${formatSummaryLine({ title: 'Tests:        ', total: totalTestCount, passed: passedTestCount, failed: failedTestCount })}
`;

  log(summary);
};
