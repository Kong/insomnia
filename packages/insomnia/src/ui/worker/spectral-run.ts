
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';

import type { SpectralResponse } from './spectral';

export class SpectralRunner {
  private worker: Worker;
  private taskId = 0;

  constructor() {
    // @INFO: This is only for inso cli since it ends up in the import map and gets type-checked against a node environment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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
      this.worker.onmessage = (e: MessageEvent<SpectralResponse>) => {
        const { id, diagnostics } = e.data;

        // onmessage callback will be called several times in one promise,
        // and promise can be resolved or rejected only once, so we cant reject it here
        // NOTE: we will depend on the garbage collection to clean up the unresolved promises
        const hasResultForThisTask = id === this.taskId && diagnostics;
        if (hasResultForThisTask) {
          resolve(diagnostics);
          return;
        }
        if (diagnostics) {
          console.log('[spectral] Received diagnostics for old task, ignoring');
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
