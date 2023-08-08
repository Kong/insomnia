import type { Stats } from 'mocha';

interface TestErr {
  generatedMessage: boolean;
  name: string;
  code: string;
  actual: string;
  expected: string;
  operator: string;
}

interface NodeErr {
  message: string;
  stack: string;
}

export interface TestResult {
  title: string;
  fullTitle: string;
  file?: string;
  duration?: number;
  currentRetry: number;
  err: TestErr | NodeErr | {};
}

export interface TestResults {
  failures: TestResult[];
  passes: TestResult[];
  pending: TestResult[];
  stats: Stats;
  tests: TestResult[];
}
