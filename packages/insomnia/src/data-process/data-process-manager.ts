import path from 'node:path';

import type { UtilityProcess } from 'electron';
import { BrowserWindow, MessageChannelMain, utilityProcess } from 'electron';
import type { ChangeBufferEvent, ChangeListener } from 'insomnia-data';

import { isDevelopment } from '../common/constants';
import { PortRpc } from './port-rpc';
import { deserializeValue } from './serialization';

let child: UtilityProcess | null = null;

const MAX_RESTARTS = 10;
const RESTART_WINDOW_MS = 60_000;
let restartCount = 0;
let lastRestartTime = 0;

const mainProcessChangeListeners: ChangeListener[] = [];
let deepLinkHandler: ((uri: string) => void) | null = null;

export function registerMainProcessChangeListener(listener: ChangeListener): void {
  mainProcessChangeListeners.push(listener);
}

export function registerDeepLinkHandler(handler: (uri: string) => void): void {
  deepLinkHandler = handler;
}

function getDataProcessPath(): string {
  return path.join(__dirname, 'entry.data.min.js');
}

// Messages from a UtilityProcess arrive as the raw value passed to
// process.parentPort.postMessage() on the child side - NOT wrapped in
// an { data: ... } envelope.  Use this helper to cast safely.
function castMessageEvent(event: Electron.MessageEvent): Record<string, unknown> {
  return event as unknown as Record<string, unknown>;
}

// Main process's own RPC client for the data-process.
// After spawnDataProcess() completes, this is attached and ready to use.
export const mainRpc = new PortRpc();

export async function spawnDataProcess(dbPath: string): Promise<void> {
  const inspectArgs = isDevelopment() ? ['--inspect=9229'] : [];
  console.log('[data-process] spawning...', { dbPath, inspectArgs });
  child = utilityProcess.fork(getDataProcessPath(), [], {
    execArgv: inspectArgs,
    stdio: 'pipe',
  });

  child.stdout?.on('data', (d: Buffer) => process.stdout.write(`[data-process:stdout] ${d}`));
  child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[data-process:stderr] ${d}`));

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('[data-process] timed out waiting for ready signal'));
    }, 30_000);

    const onMessage = (event: Electron.MessageEvent) => {
      const msg = castMessageEvent(event);
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        child!.off('message', onMessage);
        console.log('[data-process] ready');
        resolve();
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        child!.off('message', onMessage);
        reject(new Error(`[data-process] init failed: ${msg.message}`));
      }
    };

    child!.on('message', onMessage);

    child!.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`[data-process] exited with code ${code} before ready`));
    });

    child!.postMessage({ dbPath });
  });

  // Create a dedicated MessagePort for the main process's own RPC.
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ type: 'new-port' }, [port1]);
  mainRpc.attach(
    m => port2.postMessage(m),
    h => {
      port2.on('message', (e: Electron.MessageEvent) => h(e.data));
      port2.start();
    },
  );
  console.log('[data-process] main-process RPC port attached');

  child.on('message', (event: Electron.MessageEvent) => {
    const msg = castMessageEvent(event);
    if (msg.type === 'db.changes') {
      const changes = deserializeValue(msg.changes) as ChangeBufferEvent[];
      BrowserWindow.getAllWindows().forEach(w => {
        w.webContents.send('db.changes', changes);
      });
      mainProcessChangeListeners.forEach(listener => listener(changes));
    } else if (msg.type === 'deep-link' && deepLinkHandler) {
      deepLinkHandler(msg.uri as string);
    }
  });

  child.on('exit', code => {
    console.warn(`[data-process] exited with code ${code}`);
    handleExit(dbPath);
  });
}

export function issuePort(window: BrowserWindow): void {
  if (!child) {
    console.error('[data-process] cannot issue port - data process not running');
    return;
  }
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ type: 'new-port' }, [port1]);
  window.webContents.postMessage('data-process.port', null, [port2]);
  console.debug('[data-process] port issued to window', { windowId: window.id });
}

function handleExit(dbPath: string): void {
  const now = Date.now();
  if (now - lastRestartTime > RESTART_WINDOW_MS) {
    restartCount = 0;
  }
  lastRestartTime = now;
  restartCount++;

  if (restartCount > MAX_RESTARTS) {
    console.error(`[data-process] exceeded ${MAX_RESTARTS} restarts within ${RESTART_WINDOW_MS / 1000}s - giving up`);
    mainRpc.invalidate('data-process crashed and could not be restarted');
    return;
  }

  const delay = Math.min(1000 * 2 ** (restartCount - 1), 10_000);
  console.warn(`[data-process] restarting in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})...`);
  mainRpc.invalidate('data-process restarting');
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('data-process.restarting'));
  child = null;
  setTimeout(() => {
    spawnDataProcess(dbPath)
      .then(() => {
        console.log('[data-process] restarted, re-issuing ports');
        restartCount = 0;
        BrowserWindow.getAllWindows().forEach(w => issuePort(w));
      })
      .catch(e => {
        console.error('[data-process] failed to restart:', e);
      });
  }, delay);
}
