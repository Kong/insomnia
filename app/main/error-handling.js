export function init () {
  process.on('uncaughtException', e => {
    console.error('[catcher] Uncaught exception:', e);
  });
}
