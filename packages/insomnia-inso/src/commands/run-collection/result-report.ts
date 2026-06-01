import fs from 'node:fs';
import nodePath from 'node:path';

import type { ConsolaInstance } from 'consola';
import { pick } from 'es-toolkit';

import type {
  Environment,
  Request,
  RequestAuthentication,
  RequestHeader,
  RequestTestResult,
  UserUploadEnvironment,
  Workspace,
} from '~/insomnia-data';
import { typedKeys } from '~/insomnia-data/common';

interface RunReportExecution {
  request: Request;
  response: {
    status?: string;
    code?: number;
    headers?: Record<string, string>;
    data?: string;
    responseTime: number;
  };
  tests: Omit<RequestTestResult, 'category'>[];
  iteration: number;
  success: boolean;
}

type ReportData = Pick<
  RunCollectionResultReport,
  'collection' | 'environment' | 'proxy' | 'iterationCount' | 'iterationData' | 'executions' | 'startedAt' | 'error'
>;

const insensitiveBaseModelKeys = ['_id', 'type', 'parentId', 'created', 'modified', 'name'] as const;

export class RunCollectionResultReport {
  // The collection (workspace) that was run
  collection: Workspace | null = null;
  // The environment used during the run
  environment: Environment | null = null;
  // The proxy settings used during the run, if set
  proxy: {
    proxyEnabled: boolean;
    httpProxy?: string;
    httpsProxy?: string;
    noProxy?: string;
  } | null = null;
  // The number of iterations that were run
  iterationCount = 0;
  // The iteration data used during the run
  iterationData: UserUploadEnvironment[] = [];
  // The executions that occurred during the run
  executions: RunReportExecution[] = [];
  // The start time of the run
  startedAt: number = Date.now();
  // The error that occurred during the run, if any
  error: string | null = null;

  constructor(
    private options: {
      outputFilePath: string;
      includeFullData?: 'redact' | 'plaintext';
    },
    private logger: ConsolaInstance,
    init?: Partial<ReportData>,
  ) {
    Object.assign(this, init);
  }

  update(partial: Partial<ReportData>) {
    Object.assign(this, partial);
  }

  addExecution(execution: RunReportExecution) {
    this.executions.push(execution);
  }

  private getTiming() {
    const responseTimes = this.executions.map(e => e.response.responseTime);

    return {
      started: this.startedAt,
      completed: Date.now(),
      responseAverage: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      responseMin: Math.min(...responseTimes),
      responseMax: Math.max(...responseTimes),
    };
  }

  private getStats() {
    const iterationStatusArray = Array.from({ length: this.iterationCount }).fill(true);
    let failedRequests = 0;
    let totalTests = 0;
    let failedTests = 0;

    for (const exec of this.executions) {
      if (exec.success === false) {
        iterationStatusArray[exec.iteration] = false;
        failedRequests += 1;
      }
      totalTests += exec.tests.length;
      failedTests += exec.tests.filter(test => test.status === 'failed').length;
    }

    return {
      iterations: {
        // The total number of iterations
        total: this.iterationCount,
        // The number of failed iterations
        failed: iterationStatusArray.filter(status => status === false).length,
      },
      requests: {
        // The total number of requests
        total: this.executions.length,
        // The number of failed requests
        failed: failedRequests,
      },
      tests: {
        // The total number of tests
        total: totalTests,
        // The number of failed tests
        failed: failedTests,
      },
    };
  }

  private getFullData() {
    return {
      collection: this.collection,
      environment: this.environment,
      proxy: this.proxy,
      // Don't expose the success field
      executions: this.executions.map(exec => pick(exec, ['request', 'response', 'tests', 'iteration'])),
      timing: this.getTiming(),
      stats: this.getStats(),
      error: this.error,
    };
  }
  private getSafeData() {
    return {
      collection: this.collection,
      environment: this.environment ? pick(this.environment, [...insensitiveBaseModelKeys, 'isPrivate']) : null,
      proxy: this.proxy,
      executions: this.executions.map(exec => ({
        request: pick(exec.request, [...insensitiveBaseModelKeys, 'description']),
        response: pick(exec.response, ['status', 'code', 'responseTime']),
        tests: exec.tests,
        iteration: exec.iteration,
      })),
      timing: this.getTiming(),
      stats: this.getStats(),
      error: this.error,
    };
  }
  private getRedactedData() {
    const REDACTED_VALUE = '<Redacted by Insomnia>';

    // Known sensitive header names (case-insensitive)
    const sensitiveHeaders = new Set([
      'cookie',
      'set-cookie',
      'authorization',
      'auth',
      'x-auth-token',
      'x-api-key',
      'api-key',
      'x-csrf-token',
      'x-xsrf-token',
      'x-access-token',
      'x-refresh-token',
      'bearer',
      'basic',
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'proxy-authorization',
    ]);

    const redactObject = <T extends Record<string, any>>(obj: T, keysToRedact?: Set<keyof T>, ignoreCase?: boolean) => {
      const redactedObject: Partial<T> = {};
      for (const [key, value] of Object.entries(obj)) {
        let needsRedaction = true;

        if (keysToRedact) {
          if (ignoreCase) {
            const keysToRedactInLowerCase = new Set(Array.from(keysToRedact).map(k => k.toString().toLowerCase()));
            needsRedaction = keysToRedactInLowerCase.has(key.toLowerCase());
          } else {
            needsRedaction = keysToRedact.has(key);
          }
        }

        redactedObject[key as keyof T] = needsRedaction ? REDACTED_VALUE : value;
      }
      return redactedObject;
    };

    const redactRequestHeaders = (headers?: RequestHeader[]) => {
      if (!headers) return headers;

      return headers.map(header => ({
        ...header,
        value: sensitiveHeaders.has(header.name?.toLowerCase()) ? REDACTED_VALUE : header.value,
      }));
    };

    const redactResponseHeaders = (headers?: Record<string, string>) => {
      if (!headers) return headers;

      return redactObject(headers, sensitiveHeaders, true);
    };

    const redactAuth = (auth?: RequestAuthentication | {}) => {
      const isValidAuth = (auth?: RequestAuthentication | {}): auth is RequestAuthentication => {
        return !!auth && Object.keys(auth).length > 0 && 'type' in auth;
      };

      if (!isValidAuth(auth)) return auth;
      const authWhitelist = new Set<string>(['type', 'disabled', 'grantType']);
      return redactObject(auth, new Set(typedKeys(auth).filter(k => !authWhitelist.has(k))));
    };

    const redactEnvironment = (env?: Environment | null) => {
      if (!env) {
        return env;
      }
      return {
        ...env,
        data: redactObject(env.data),
        ...(env.kvPairData
          ? {
              kvPairData: env.kvPairData.map(pair => ({
                ...pair,
                value: REDACTED_VALUE,
              })),
            }
          : {}),
      };
    };

    return {
      collection: this.collection,
      environment: redactEnvironment(this.environment),
      proxy: this.proxy,
      executions: this.executions.map(exec => ({
        request: {
          ...exec.request,
          headers: redactRequestHeaders(exec.request.headers),
          authentication: redactAuth(exec.request.authentication),
        },
        response: {
          ...exec.response,
          headers: redactResponseHeaders(exec.response.headers),
        },
        tests: exec.tests,
        iteration: exec.iteration,
      })),
      timing: this.getTiming(),
      stats: this.getStats(),
      error: this.error,
    };
  }

  private generateJSONReport() {
    if (this.options.includeFullData === 'plaintext') {
      return this.getFullData();
    } else if (this.options.includeFullData === 'redact') {
      return this.getRedactedData();
    }
    return this.getSafeData();
  }

  saveReport = async () => {
    if (!this.options.outputFilePath) {
      return;
    }

    const jsonReport = this.generateJSONReport();
    await fs.promises.mkdir(nodePath.dirname(this.options.outputFilePath), { recursive: true });
    await fs.promises.writeFile(this.options.outputFilePath, JSON.stringify(jsonReport, null, 2), 'utf8');
    this.logger.log('Result report saved to:', this.options.outputFilePath);
  };
}
