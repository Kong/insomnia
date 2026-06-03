type Platform = NodeJS.Platform;

interface INodeProcess {
  platform: string;
}

declare const window: {
  app?: {
    process: INodeProcess;
  };
};

let nodeProcess: INodeProcess | undefined;
if (
  // eslint-disable-next-line unicorn/no-typeof-undefined
  typeof window !== 'undefined' &&
  window.app?.process !== undefined &&
  typeof window.app.process.platform === 'string'
) {
  // Renderer: use window.app.process exposed by preload
  nodeProcess = window.app.process as INodeProcess;
} else if (typeof process !== 'undefined' && typeof process.platform === 'string') {
  // Main: use Node.js native process
  nodeProcess = process;
}

// Get platform from nodeProcess (unified approach)
const _platform: Platform = nodeProcess?.platform ? (nodeProcess.platform as Platform) : ('linux' as Platform);

// Export constants (VSCode style)
export const platform: Platform = _platform;
export const isMac: boolean = _platform === 'darwin';
export const isWindows: boolean = _platform === 'win32';
export const isLinux: boolean = _platform === 'linux';
