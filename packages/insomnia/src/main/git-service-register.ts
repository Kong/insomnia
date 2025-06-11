import path from 'node:path';

import { app, MessageChannelMain, utilityProcess } from 'electron';

import { typedKeys } from '../utils';
import {
  type GitServiceAPI,
  gitServiceAPI,
  gitServiceAPIFallback,
  type WorkerCommandList,
  workerCommandList,
} from './git-service';
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
  type: WorkerCommandList;
  result: Awaited<ReturnType<GitServiceAPI[WorkerCommandList]>>;
}

const isReadyMessage = (message: ReadyMessage | ResultMessage | ErrorMessage): message is ReadyMessage => {
  return message?.type === 'ready';
};
const isErrorMessage = (message: ReadyMessage | ResultMessage | ErrorMessage): message is ErrorMessage => {
  return message?.type === 'error';
};

const runGitCommandInWorker = <C extends WorkerCommandList>(command: C, options: Parameters<GitServiceAPI[C]>[0]) => {
  type R = ReturnType<GitServiceAPI[C]>;
  return new Promise<R>(resolve => {
    const { port1, port2 } = new MessageChannelMain();
    const gitProcess = utilityProcess.fork(path.join(__dirname, 'git-worker.js'), [], {
      env: {
        ...process.env,
        INSOMNIA_DATA_PATH: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
      },
    });

    gitProcess.on('exit', (code: number) => {
      if (code !== 0) {
        console.error(`Git worker process exited with code ${code}. This may indicate an error in the git operation.`);
        // From the current state, git operations should not crash the app, return the fallback result instead
        resolve(gitServiceAPIFallback[command]() as R);
      }
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
        resolve(gitServiceAPIFallback[command]() as R);
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

// Whether a command should be run in the worker process
const isWorkerCommand = (command: string): command is WorkerCommandList => {
  return workerCommandList.includes(command as WorkerCommandList);
};

// Register the git service API commands with the main process, some commands will run in the worker process
export const registerGitServiceAPI = () => {
  typedKeys(gitServiceAPI).forEach(command => {
    if (isWorkerCommand(command)) {
      ipcMainHandle(`git.${command}`, (_, options) => runGitCommandInWorker(command, options));
    } else {
      ipcMainHandle(`git.${command}`, (_, options) => gitServiceAPI[command](options));
    }
  });
};
