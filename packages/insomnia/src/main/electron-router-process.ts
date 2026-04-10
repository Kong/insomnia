import path from 'node:path';
import { styleText } from 'node:util';

import electron, { app, dialog, MessageChannelMain, utilityProcess } from 'electron';

import { sendRequestViaUtilityProcess } from './message-channel-http-adapter.mjs';

const ROUTER_PROCESS_LOG = styleText('bgGray', ' Router Process ');

export class RouterProcess {
  routerProcess = null;
  url = null;
  appExited = false;
  messageChannel = null;

  async init() {
    if (this.routerProcess) {
      console.warn(ROUTER_PROCESS_LOG, 'Router process is already running.');
      return { url: this.url };
    }

    this.routerProcess = utilityProcess.fork(path.join(__dirname, 'main/router-process.mjs'), null, {
      serviceName: 'electron-router',
      stdio: 'pipe',
    });

    // Create the message channel once during initialization
    this.messageChannel = new MessageChannelMain();

    this.attachListeners();

    return this.start();
  }

  async start() {
    if (!this.routerProcess) {
      throw new Error('Router process is not initialized.');
    }

    // Send init message with the port2 for communication
    this.routerProcess.postMessage({ type: 'init' }, [this.messageChannel.port2]);

    return new Promise((resolve, reject) => {
      this.routerProcess.on('message', msg => {
        // Handle utility-process API proxy requests
        if (msg.type === 'electron-api-request') {
          const { id, method, args } = msg;
          // Traverse nested API path
          const parts = method.split('.');
          let target = electron;
          let func = electron;
          for (const part of parts) {
            if (!func || !(part in func)) {
              this.routerProcess.postMessage({
                type: 'electron-api-response',
                id,
                error: `Method not found: ${method}`,
              });
              return;
            }
            target = func;
            func = func[part];
          }
          try {
            const resultOrPromise = func.apply(target, args);
            if (resultOrPromise && typeof resultOrPromise.then === 'function') {
              resultOrPromise
                .then(res =>
                  this.routerProcess.postMessage({
                    type: 'electron-api-response',
                    id,
                    result: res,
                  }),
                )
                .catch(err =>
                  this.routerProcess.postMessage({
                    type: 'electron-api-response',
                    id,
                    error: String(err),
                  }),
                );
            } else {
              this.routerProcess.postMessage({
                type: 'electron-api-response',
                id,
                result: resultOrPromise,
              });
            }
          } catch (error) {
            this.routerProcess.postMessage({
              type: 'electron-api-response',
              id,
              error: String(error),
            });
          }
          return;
        }

        if (msg.type === 'url') {
          this.url = msg.url;
          // When we get the url, we know the port setup was successful
          resolve({ url: this.url });
        } else if (msg.type === 'error') {
          console.error(ROUTER_PROCESS_LOG, 'Error:', msg.error);
          reject(new Error(msg.error));
        }
      });
    });
  }

  attachListeners() {
    this.routerProcess.stderr.on('data', data => {
      console.error(ROUTER_PROCESS_LOG, 'Router process stderr:', data.toString());
    });

    this.routerProcess.on('error', err => {
      console.error(ROUTER_PROCESS_LOG, 'Router process error:', err);
    });

    this.routerProcess.stdout.on('data', data => {
      console.log(ROUTER_PROCESS_LOG, 'Router process stdout:', data.toString());
    });

    app.on('before-quit', () => {
      console.warn(ROUTER_PROCESS_LOG, 'App is exiting, terminating router process...');
      this.appExited = true;
      if (this.routerProcess) {
        this.routerProcess.kill();
        this.routerProcess = null;
      }
      if (this.messageChannel) {
        this.messageChannel.port1.close();
        this.messageChannel.port2.close();
        this.messageChannel = null;
      }
    });

    this.routerProcess.on('exit', async code => {
      console.error(ROUTER_PROCESS_LOG, 'Router process exited with code:', code);
      this.routerProcess = null;
      this.messageChannel = null; // Clear the message channel when process exits

      // We can restart the router process here.
      // A big concern is that this can lead to an infinite loop if the process keeps crashing.
      // If the app exits then it sends a signal to kill the utility process and the code will be 143. This means that the app was closed gracefully.
      // if (code === 1) {
      // console.error(ROUTER_LOG, "Restarting router process...");
      // await this.init();
      // }
    });
  }

  async fetch(request) {
    if (this.appExited) {
      console.warn(ROUTER_PROCESS_LOG, 'App has exited, cannot send request.');
      return new Response('App has exited, cannot send request.', {
        status: 500,
      });
    }

    if (!this.routerProcess) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'An unexpected error occurred',
        buttons: ['Restart the app'],
        message: 'An unexpected error occured. Please share this with the developers.',
      });

      await this.init();
    }

    // If message channel is null, recreate it and reinitialize the router process
    if (!this.messageChannel) {
      console.warn(ROUTER_PROCESS_LOG, 'Message channel is null, reinitializing router process.');
      await this.init();
    }

    try {
      return sendRequestViaUtilityProcess(this.routerProcess, request, this.messageChannel.port1);
    } catch (error) {
      console.error(ROUTER_PROCESS_LOG, 'Error sending request:', error);
      return new Response(`Error sending request: ${error.message}`, {
        status: 500,
      });
    }
  }
}
