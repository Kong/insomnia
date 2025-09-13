import fs, { existsSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'csv-parse/sync';

import { test } from './app';

/**
 * Test configuration type matching CSV columns
 */
export interface TestConfig {
  run?: 'yes' | 'no';  // Whether to run the test (default: 'yes')
  path?: string;       // Physical path to test files
  filename?: string;   // Test file prefix (without .test.ts)
}

/**
 * Type for test case implementation functions
 */
export type TestCaseFunction = (params: {
  page: any;
  record: any;
}) => Promise<void>;

// Cached test configurations
let testConfigs: TestConfig[] = [];

export const TestRunner = {
  /**
   * Load and process test configuration from CSV
   * @param configPath Path to configuration CSV file
   */
  setConfig(configPath: string) {
    if (!existsSync(configPath)) {
      console.warn(`Config file not found: ${configPath}`);
      testConfigs = [];
      return;
    }

    // Parse CSV and process configurations
    const rawConfigs = parse(fs.readFileSync(configPath), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as { run?: string; path?: string; filename?: string }[];

    testConfigs = rawConfigs
      .filter((cfg, idx) => {
        if (!cfg.path && !cfg.filename) {
          console.warn(`Invalid config at line ${idx + 2}: path or filename required`);
          return false;
        }
        return true;
      })
      .map(cfg => ({
        run: (cfg.run?.toLowerCase() === 'no' ? 'no' : 'yes') as 'yes' | 'no',
        path: cfg.path?.replace(/\\/g, '/').trim(),
        filename: cfg.filename?.trim()
      }));
  },

  /**
   * Get path of the file that called the run() method
   * Uses more robust stack trace parsing to work with Playwright
   */
  getCallerFile(): string {
    // Create error with meaningful message
    const error = new Error('Call stack for test file path detection');
    const stack = error.stack?.split('\n') || [];

    // Debug: Log stack trace for troubleshooting (can be removed later)
    // console.log('Stack trace for debugging:', stack);

    // Look for any line that contains a .test.ts file (common pattern for test files)
    // This is more reliable in Playwright environment
    const testFileLine = stack.find(line =>
      line.includes('.test.ts') && !line.includes('test-runner.ts')
    );

    if (!testFileLine) {
      // Fallback: Try to find any line with a TS file that's not the runner itself
      const tsFileLine = stack.find(line =>
        line.includes('.ts') && !line.includes('test-runner.ts')
      );

      if (!tsFileLine) {
        throw new Error('Failed to detect test file: No test file found in stack trace');
      }
      return this.extractPathFromLine(tsFileLine);
    }

    return this.extractPathFromLine(testFileLine);
  },

  /**
 * Helper method to extract file path from a stack trace line
 */
  extractPathFromLine(line: string): string {
    // Handle different stack trace formats
    const pathMatch = line.match(/\((.*?):\d+:\d+\)/) || line.match(/at (.*?):\d+:\d+/);

    if (!pathMatch || !pathMatch[1]) {
      throw new Error(`Failed to parse path from stack line: ${line}`);
    }

    // Clean up path (remove any protocol prefixes like file://)
    let filePath = pathMatch[1];
    if (filePath.startsWith('file://')) {
      filePath = decodeURIComponent(filePath.slice(7));
    }

    return filePath;
  },

  /**
   * Check if test should run based on configuration
   * @param testFile Path to the test file
   */
  shouldRun(testFile: string): boolean {
    if (testConfigs.length === 0) return true;

    const normalizedPath = testFile.replace(/\\/g, '/');
    const filePrefix = path.basename(testFile).replace('.test.ts', '');

    return testConfigs.some(cfg => {
      if (cfg.run === 'no') return false;
      if (cfg.path && !normalizedPath.includes(cfg.path)) return false;
      if (cfg.filename && !filePrefix.startsWith(cfg.filename)) return false;
      return true;
    });
  },

  /**
   * Run test with auto-detected file path
   * @param testName Name of the test
   * @param testFunc Test implementation
   * @param options Optional settings (parallel execution)
   */
  async run(
    testName: string,
    testFunc: TestCaseFunction,
    options: { parallel?: boolean } = {}
  ) {
    // Auto-detect test file path from call stack
    const testFile = this.getCallerFile();

    if (!this.shouldRun(testFile)) {
      const filePrefix = path.basename(testFile).replace('.test.ts', '');
      console.log(`Skipping test: ${testName} (file: ${filePrefix}.test.ts)`);
      return;
    }

    const dataFile = path.join(
      path.dirname(testFile),
      `${path.basename(testFile).replace('.test.ts', '')}_data.csv`
    );
    const describe = options.parallel ? test.describe.parallel : test.describe;

    describe(testName, () => {
      if (existsSync(dataFile)) {
        const records = parse(fs.readFileSync(dataFile), {
          columns: true,
          skip_empty_lines: true,
        });

        records.forEach((record: any, i: number) => {
          const caseName = `Case ${i + 1} - ${record.test_case || ''}`;
          test(caseName, async ({ page }: { page: any }) => {
            await testFunc({ page, record });
          });
        });
      } else {
        test(testName, async ({ page }: { page: any }) => {
          await testFunc({ page, record: {} });
        });
      }
    });
  },
};
