import { step } from "@package/misc/step";

import { BaseFlow } from "./base.flow";

export class AppFlow extends BaseFlow {




  /**
   * Reads the main process's `userData` directory — the same path
   * Insomnia backs up its NeDB `.db` files under (`<dataPath>/backups`).
   */
  @step()
  async getDataPath(): Promise<string> {
    return this.context.electronApp!.evaluate(({ app }) =>
      app.getPath("userData"),
    );
  }


  /**
   * Captures every line the main process writes to stdout/stderr while
   * `action` runs, plus a short settle window afterward (log lines can
   * trail slightly behind the action that produced them), and returns
   * them in order. Only lines written during this call are captured —
   * nothing from before it started.
   */
  @step()
  async captureMainProcessLog(action: () => Promise<void>): Promise<string[]> {
    const lines: string[] = [];
    const proc = this.context.electronApp!.process();
    const onData = (chunk: Buffer) => {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    try {
      await action();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
    }
    return lines;
  }

}
