import { Stats } from 'mocha';

type TestErr = {
  generatedMessage: boolean;
  name: string;
  code: string;
  actual: string;
  expected: string;
  operator: string;
}

type NodeErr = {
  message: string;
  stack: string;
}

export type TestResult = {
  title: string;
  fullTitle: string;
  file?: string;
  duration?: number;
  currentRetry: number;
  err: TestErr | NodeErr | {};
}

export type TestResults = {
  failures: TestResult[];
  passes: TestResult[];
  pending: TestResult[];
  stats: Stats;
  tests: TestResult[];
}
