import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { InsoResult } from "@package/misc/inso-cli";
import { runInso } from "@package/misc/inso-cli";
import { step } from "@package/misc/step";

import { BaseFlow } from "./base.flow";

export interface RunCollectionOptions {
  /** `--workingDir`: an app data directory, a git repository root or an export file. */
  workingDir: string;
  /** The collection to run: a workspace id or name. Omitted, inso picks the only/first one. */
  workspaceId?: string;
  /** `--encryption-key <key>`. */
  encryptionKeyOption?: string;
  /** `INSOMNIA_ENCRYPTION_KEY` in inso's environment. */
  encryptionKeyEnv?: string;
  /** `--printOptions`. */
  printOptions?: boolean;
  /**
   * `--ci` (default true). The CI reporter prints objects as `[object Object]`, so `--printOptions` output can only be
   * read without it — pass `environmentId` then, or inso asks which environment to use.
   */
  ci?: boolean;
  /** `--env`: an environment id of the collection. */
  environmentId?: string;
  /**
   * `--includeFullData plaintext --acceptRisk`: the report then carries each
   * request's headers/authentication and each response's headers/body, returned
   * as `executions`. Without it the report only has status codes and timings.
   */
  includeFullData?: boolean;
}

/** One request's entry in inso's `--output` report (full-data mode). */
export interface RunExecution {
  request?: {
    headers?: { name: string; value: string; disabled?: boolean }[];
    authentication?: Record<string, unknown>;
  };
  response?: { code?: number; data?: string; headers?: Record<string, string> };
}

export interface RunCollectionResult extends InsoResult {
  /** The HTTP status code of every request that ran, in order (from `--output`); empty if inso wrote no report. */
  statusCodes: number[];
  /** Raw report executions, in order; request/response detail needs `includeFullData`. */
  executions: RunExecution[];
}

export class InsoFlow extends BaseFlow {
  /**
   * Runs `inso lint spec <specFile>` and returns its stdout, stderr and exit
   * code. `specFile` is an absolute path to an OpenAPI spec file; a spec with
   * lint errors resolves with a non-zero `exitCode` rather than rejecting.
   */
  @step()
  async lintSpec(specFile: string): Promise<InsoResult> {
    return runInso(["lint", "spec", specFile]);
  }

  /**
   * Runs `inso run collection <workspaceId> --ci` against `workingDir` and
   * returns its output, exit code and the status code of every request it
   * sent. A failing run resolves with a non-zero `exitCode` rather than
   * rejecting.
   *
   * inso rewrites the NeDB files it loads, so point it at a copy of an app
   * data directory, never at the one a running app uses.
   */
  @step()
  async runCollection(options: RunCollectionOptions): Promise<RunCollectionResult> {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-inso-run-"));
    const output = path.join(outputDir, "report.json");
    try {
      const args = [
        "run",
        "collection",
        ...(options.workspaceId ? [options.workspaceId] : []),
        "--workingDir",
        options.workingDir,
        "--output",
        output,
      ];
      if (options.ci ?? true) args.push("--ci");
      if (options.environmentId) args.push("--env", options.environmentId);
      if (options.encryptionKeyOption !== undefined) {
        args.push("--encryption-key", options.encryptionKeyOption);
      }
      if (options.printOptions) args.push("--printOptions");
      if (options.includeFullData) args.push("--includeFullData", "plaintext", "--acceptRisk");
      const result = await runInso(
        args,
        undefined,
        options.encryptionKeyEnv === undefined ? {} : { INSOMNIA_ENCRYPTION_KEY: options.encryptionKeyEnv },
      );
      const executions: RunExecution[] = fs.existsSync(output)
        ? (JSON.parse(fs.readFileSync(output, "utf8")).executions ?? [])
        : [];
      const statusCodes = executions.map((execution) => execution.response?.code as number);
      return { ...result, statusCodes, executions };
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  }
}
