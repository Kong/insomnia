import path from 'node:path';

import { app, ipcMain, MessageChannelMain, type UtilityProcess, utilityProcess } from 'electron';

import { typedKeys } from '../utils';
import { type GitServiceAPI, gitServiceAPI, updateHasUncommittedChanges } from './git-service';
import {
  type GitWorkerServiceAPI,
  gitWorkerServiceAPI,
  type GitWorkerServiceAPIKeys,
  gitWorkerServiceFallbacks,
} from './git-worker-service';
import { ipcMainHandle } from './ipc/electron';

export const readyMessage = {
  type: 'ready',
} as const;

export type ReadyMessage = typeof readyMessage;
export interface ErrorMessage {
  type: 'error';
  error: string;
}
export interface ResultMessage {
  type: GitWorkerServiceAPIKeys;
  result: Awaited<ReturnType<GitWorkerServiceAPI[GitWorkerServiceAPIKeys]>>;
}

const isReadyMessage = (message: ReadyMessage | ResultMessage | ErrorMessage): message is ReadyMessage => {
  return message?.type === 'ready';
};
const isErrorMessage = (message: ReadyMessage | ResultMessage | ErrorMessage): message is ErrorMessage => {
  return message?.type === 'error';
};

const runningGitProcesses = new Map<string, UtilityProcess>();

const runGitCommandInWorker = <C extends GitWorkerServiceAPIKeys>(
  command: C,
  options: Parameters<GitWorkerServiceAPI[C]>[0] & {
    pid: string;
  },
) => {
  type R = ReturnType<GitWorkerServiceAPI[C]>;

  console.warn(`[debug] Running git command "${command}"`, options);

  return new Promise<R>(resolve => {
    const { port1, port2 } = new MessageChannelMain();
    const gitProcess = utilityProcess.fork(path.join(__dirname, 'git-worker.js'), [], {
      env: {
        ...process.env,
        INSOMNIA_DATA_PATH: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
      },
    });

    runningGitProcesses.set(options.pid, gitProcess);

    gitProcess.on('exit', (code: number) => {
      console.warn(`[debug] git worker process exited with code ${code} for command "${command}"`);
      if (code !== 0) {
        console.error(`Git worker process exited with code ${code}. This may indicate an error in the git operation.`);
        // Git operations should not crash the app, return the fallback result instead
        resolve(gitWorkerServiceFallbacks[command]() as R);
      }
      runningGitProcesses.delete(options.pid);
    });

    // Send one end of the port to the git utility process
    gitProcess.postMessage({}, [port2]);

    port1.on('message', message => {
      const data: ResultMessage | ErrorMessage | ReadyMessage = message.data;

      if (isReadyMessage(data)) {
        port1.postMessage({
          type: command,
          payload: {
            args: options,
          },
        });
      } else if (isErrorMessage(data)) {
        gitProcess.kill();
        console.error('gitProcess sent an error', data);
        resolve(gitWorkerServiceFallbacks[command]() as R);
      } else if (data.type === command) {
        gitProcess.kill();
        resolve(data.result as R);
      } else {
        console.warn('gitProcess sent unexpected message:', data);
      }
    });

    port1.start();
  });
};

// Register the git service API commands with the main process, some commands will run in the worker process
export const registerGitServiceAPI = () => {
  typedKeys(gitServiceAPI).forEach(command => {
    ipcMainHandle(`git.${command}`, (_, options) => gitServiceAPI[command](options));
  });

  // The git worker service API commands only support read-only operations to avoid data corruption.
  ipcMainHandle('git.gitStatus', async (_, options) => {
    const result = await runGitCommandInWorker('gitStatus', options);

    await updateHasUncommittedChanges({
      projectId: options.projectId,
      workspaceId: options.workspaceId,
      hasUncommittedChanges: result.status.localChanges > 0,
    });

    return result;
  });

  ipcMainHandle('git.gitChangesLoader', async (_, options) => {
    const result = await runGitCommandInWorker('gitChangesLoader', options);

    await updateHasUncommittedChanges({
      projectId: options.projectId,
      workspaceId: options.workspaceId,
      hasUncommittedChanges: result.changes.staged.length > 0 || result.changes.unstaged.length > 0,
    });

    return result;
  });

  ipcMainHandle('git.abortGitWorkerOperation', (_, { pid }) => {
    console.warn(`[debug] Request aborting git operation with pid ${pid}`);
    const gitProcess = runningGitProcesses.get(pid);
    if (gitProcess) {
      gitProcess.kill();
      runningGitProcesses.delete(pid);
      console.warn(`[debug] Aborted git operation with pid ${pid}`);
    } else {
      console.warn(`[debug] No git operation found with pid ${pid}`);
    }
  });
};

// Git worker services could be aborted, so we need to pass the pid to the worker service API
export type GitServiceMainAPI = GitServiceAPI & {
  abortGitWorkerOperation: (options: { pid: string }) => void;
  gitStatus: (
    options: Parameters<GitWorkerServiceAPI['gitStatus']>[0] & { pid: string },
  ) => Promise<ReturnType<GitWorkerServiceAPI['gitStatus']>>;
  diffFileLoader: (
    options: Parameters<GitWorkerServiceAPI['diffFileLoader']>[0] & { pid: string },
  ) => Promise<ReturnType<GitWorkerServiceAPI['diffFileLoader']>>;
  gitChangesLoader: (
    options: Parameters<GitWorkerServiceAPI['gitChangesLoader']>[0] & { pid: string },
  ) => Promise<ReturnType<GitWorkerServiceAPI['gitChangesLoader']>>;
};
