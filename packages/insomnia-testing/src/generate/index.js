// @flow

import { escapeJsStr, indent } from './util';
import fs from 'fs';
import path from 'path';
import os from 'os';

type Test = {
  name: string,
  code: string,
};

type Suite = {
  name: string,
  suites: Array<Suite>,
  tests?: Array<Test>,
};

export async function generate(suites: Array<Suite>): Promise<string> {
  const lines = [];

  // Require necessary dependencies
  lines.push(`const assert = require('assert');`);
  lines.push('');

  for (const s of suites || []) {
    lines.push(...generateSuiteLines(0, s));
  }

  return lines.join('\n');
}

export async function generateToFile(filepath: string, suites: Array<Suite>): Promise<void> {
  const js = await generate(suites);
  return fs.promises.writeFile(filepath, js);
}

/**
 * Generate test to a temporary file and return path. This is useful for testing
 * @param suites
 * @returns {Promise<void>}
 */
export async function generateToTmpFile(suites: Array<Suite>): Promise<string> {
  const p = path.join(os.tmpdir(), `${Math.random()}.test.js`);
  await generateToFile(p, suites);
  return p;
}

function generateSuiteLines(n: number, suite: ?Suite): Array<string> {
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
