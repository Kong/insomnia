
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';

export class SpectralRunner {
  private worker: Worker;
  private taskId = 0;

  constructor() {
    this.worker = new Worker(new URL('./spectral.ts', import.meta.url), {
      type: 'module',
    });
  }

  terminate() {
    this.worker.terminate();
  }

  public async runDiagnostics({ contents, rulesetPath }: { contents: string; rulesetPath: string }) {
    this.taskId = this.taskId++;
    return new Promise<ISpectralDiagnostic[]>((resolve, reject) => {
      this.worker.onmessage = e => {
        const { id, diagnostics } = e.data;

        if (id === this.taskId && diagnostics) {
          resolve(diagnostics);
        } else {
          reject(e.data);
        }
      };

      this.worker.postMessage({
        contents,
        rulesetPath,
        taskId: this.taskId,
      });
    });
  }
};
