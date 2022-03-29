import { writeFile } from 'fs';

import { escapeJsStr, indent } from './util';

export interface Test {
  name: string;
  code: string;
  defaultRequestId: string | null;
}

export interface TestSuite {
  name: string;
  suites: TestSuite[];
  tests?: Test[];
}

export const generate = (suites: TestSuite[]) => {
  const lines = [
    'const { expect } = chai;',
    '',
    '// Clear active request before test starts (will be set inside test)',
    'beforeEach(() => insomnia.clearActiveRequest());',
    '',
  ];

  for (const s of suites || []) {
    lines.push(...generateSuiteLines(0, s));
  }

  return lines.join('\n');
};

export const generateToFile = async (
  filepath: string,
  suites: TestSuite[],
) => {
  return new Promise<void>((resolve, reject) => {
    const js = generate(suites);
    return writeFile(filepath, js, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const generateSuiteLines = (
  n: number,
  suite?: TestSuite | null,
) => {
  if (!suite) {
    return [];
  }

  const lines: string[] = [];
  lines.push(indent(n, `describe('${escapeJsStr(suite.name)}', () => {`));
  const suites = suite.suites || [];

  for (let i = 0; i < suites.length; i++) {
    if (i !== 0) {
      lines.push('');
    }

    lines.push(...generateSuiteLines(n + 1, suites[i]));
  }

  const tests = suite.tests || [];

  for (let i = 0; i < tests.length; i++) {
    // Add blank like if
    // - it's the first test
    // - we've outputted suites above
    if (suites.length > 0 || i !== 0) {
      lines.push('');
    }

    lines.push(...generateTestLines(n + 1, tests[i]));
  }

  lines.push(indent(n, '});'));
  return lines;
};

const generateTestLines = (n: number, test?: Test | null) => {
  if (!test) {
    return [];
  }

  const lines: string[] = [];

  // Define test it() block (all test cases are async by default)
  lines.push(indent(n, `it('${escapeJsStr(test.name)}', async () => {`));

  // Add helper variables that are necessary
  const { defaultRequestId } = test;

  if (typeof defaultRequestId === 'string') {
    lines.push(indent(n, '// Set active request on global insomnia object'));
    lines.push(
      indent(n, `insomnia.setActiveRequestId('${defaultRequestId}');`),
    );
  }

  // Add user-defined test source
  test.code && lines.push(indent(n + 1, test.code));

  // Close the it() block
  lines.push(indent(n, '});'));
  return lines;
};
