export type Runtime = 'electron-main' | 'electron-renderer' | 'node' | 'unknown';

function getRuntime(): Runtime {
  // Electron
  if (process.versions?.electron) {
    if (process.type === 'browser') return 'electron-main';
    if (process.type === 'renderer') return 'electron-renderer';

    return 'unknown';
  }

  // Node.js
  if (process.release?.name === 'node' && typeof window === 'undefined') {
    return 'node';
  }

  // Unknown runtime
  return 'unknown';
}

export const runtime = getRuntime();
