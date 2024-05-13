
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
    this.taskId = ++this.taskId;
    return new Promise<ISpectralDiagnostic[]>(resolve => {
      this.worker.onmessage = e => {
        const { id, diagnostics } = e.data;

        // onmessage callback will be called several times in one promise, and promise can be resolved or rejected only once, so we cant reject it here
        if (id === this.taskId && diagnostics) {
          resolve(diagnostics);
        } else if (diagnostics) {
          console.log('Received diagnostics for old task, ignoring');
        } else {
          console.error('Error while running diagnostics:', e.data);
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
