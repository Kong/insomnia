import { database } from './common/database';
import { type GitServiceAPI, gitServiceAPI, type WorkerCommandList } from './main/git-service';
import { type ErrorMessage, readyMessage, type ResultMessage } from './main/git-service-register';
import * as models from './models';

process.parentPort.once('message', async message => {
  const [port] = message.ports;

  port.on('message', async message => {
    const data = message.data as {
      type: WorkerCommandList;
      payload: {
        args: Parameters<GitServiceAPI[WorkerCommandList]>[0];
      };
    };

    try {
      const args = data.payload.args;
      await database.init(models.types());
      await gitServiceAPI.loadGitRepository(args);

      // gitServiceAPI is a constant, so we can safely cast it to a Record type to avoid TypeScript errors
      const result = await (
        gitServiceAPI as Record<
          WorkerCommandList,
          (...args: Parameters<GitServiceAPI[WorkerCommandList]>) => ReturnType<GitServiceAPI[WorkerCommandList]>
        >
      )[data.type](args);

      port.postMessage({
        type: data.type,
        result,
      } as ResultMessage);

      console.log('[debug] Git operation handled successfully');
    } catch (error) {
      port.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ErrorMessage);

      console.error('[debug] Error handling git operation:', error);
    }
  });

  port.start();
  port.postMessage(readyMessage);
});
