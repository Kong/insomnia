// @flow

import { escapeJsStr, indent } from './util';
import fs from 'fs';

export type Test = {
  name: string,
  code: string,
};

export type TestSuite = {
  name: string,
  suites: Array<TestSuite>,
  tests?: Array<Test>,
};

export function generate(suites: Array<TestSuite>): string {
  const lines = [];

  for (const s of suites || []) {
    lines.push(...generateSuiteLines(0, s));
  }

  return lines.join('\n');
}

export async function generateToFile(filepath: string, suites: Array<TestSuite>): Promise<void> {
  const js = generate(suites);
  return fs.promises.writeFile(filepath, js);
}

function generateSuiteLines(n: number, suite: ?TestSuite): Array<string> {
  if (!suite) {
    return [];
  }

  const lines = [];
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

  lines.push(indent(n, `});`));
  return lines;
}

function generateTestLines(n: number, test: ?Test): Array<string> {
  if (!test) {
    return [];
  }

  const lines = [];

  lines.push(indent(n, `it('${escapeJsStr(test.name)}', async () => {`));
  test.code && lines.push(indent(n + 1, test.code));
  lines.push(indent(n, `});`));

  return lines;
}
