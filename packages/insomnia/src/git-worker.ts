import { database } from './common/database';
import { gitServiceAPI } from './main/git-service';
import { type ErrorMessage, readyMessage, type ResultMessage } from './main/git-service-register';
import { type GitWorkerServiceAPI, gitWorkerServiceAPI, type GitWorkerServiceAPIKeys } from './main/git-worker-service';
import * as models from './models';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

process.parentPort.once('message', async message => {
  const [port] = message.ports;

  port.on('message', async message => {
    const data = message.data as {
      type: GitWorkerServiceAPIKeys;
      payload: {
        args: Parameters<GitWorkerServiceAPI[GitWorkerServiceAPIKeys]>[0];
      };
    };

    await sleep(10000); // Allow time for the port to be ready

    try {
      const args = data.payload.args;
      await database.init(models.types());
      await gitServiceAPI.loadGitRepository(args);

      // gitWorkerServiceAPI is a constant, so we can safely cast it to a Record type to avoid TypeScript errors
      const result = await (
        gitWorkerServiceAPI as Record<
          GitWorkerServiceAPIKeys,
          (
            ...args: Parameters<GitWorkerServiceAPI[GitWorkerServiceAPIKeys]>
          ) => ReturnType<GitWorkerServiceAPI[GitWorkerServiceAPIKeys]>
        >
      )[data.type](args);

      port.postMessage({
        type: data.type,
        result,
      } as ResultMessage);
    } catch (error) {
      port.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorMessage);

      console.error('[debug] Error handling git operation:', data.type, error);
    }
  });

  port.start();
  port.postMessage(readyMessage);
});
