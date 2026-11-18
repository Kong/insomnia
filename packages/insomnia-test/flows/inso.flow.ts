import type { InsoResult } from "@package/misc/inso-cli";
import { runInso } from "@package/misc/inso-cli";
import { step } from "@package/misc/step";

import { BaseFlow } from "./base.flow";

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
}
