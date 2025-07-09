import { type ChildProcess, spawn } from 'node:child_process';
import { builtinModules } from 'node:module';
import path from 'node:path';

import esbuild, { type BuildOptions, type Plugin } from 'esbuild';

import pkg from './package.json';

interface Options {
  mode?: 'development' | 'production';
  autoRestart?: boolean;
}
const inspectPort = process.env.INSPECT_PORT || '5858';

export default async function build(options: Options) {
  const mode = options.mode || 'production';
  const __DEV__ = mode !== 'production';
  const PORT = pkg.dev['dev-server-port'];
  const autoRestart = options.autoRestart || false;

  const outdir = __DEV__ ? path.join(__dirname, 'src') : path.join(__dirname, 'build');

  const env: Record<string, string> = __DEV__
    ? {
        'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:${PORT}/index.html`),
        'process.env.HIDDEN_BROWSER_WINDOW_URL': JSON.stringify(`http://localhost:${PORT}/hidden-window.html`),
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.INSOMNIA_ENV': JSON.stringify('development'),
        'process.env.BUILD_DATE': JSON.stringify(new Date()),
      }
    : {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.INSOMNIA_ENV': JSON.stringify('production'),
        'process.env.BUILD_DATE': JSON.stringify(new Date()),
      };

  const preloadBuildOptions: BuildOptions = {
    entryPoints: ['./src/preload.ts'],
    outfile: path.join(outdir, 'preload.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
  };

  const hiddenBrowserWindowPreloadBuildOptions: BuildOptions = {
    entryPoints: ['./src/hidden-window-preload.ts'],
    outfile: path.join(outdir, 'hidden-window-preload.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
    loader: {
      '.node': 'copy',
    },
  };

  const mainBuildOptions: BuildOptions = {
    entryPoints: ['./src/main.development.ts'],
    outfile: path.join(outdir, 'main.min.js'),
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    define: env,
    external: [
      'electron',
      '@getinsomnia/node-libcurl',
      'fsevents',
      ...Object.keys(pkg.dependencies),
      ...Object.keys(builtinModules),
    ],
  };

  let electronProcess: ChildProcess;
  const startElectron = () => {
    electronProcess = spawn('electron', [`--inspect=${inspectPort}`, '.'], {
      stdio: 'inherit',
      env: process.env,
      shell: true,
    });
  };

  if (__DEV__ && autoRestart) {
    // build script with auto reload
    console.log('[Dev Build] Watching for main process changes...');
    let buildCount = 0;
    const restartElectronPlugin = (scriptName: string): Plugin => ({
      name: 'restart-electron',
      setup: build => {
        build.onStart(() => {
          console.log(`[Dev Build] Detecting changes, rebuild ${scriptName}`);
        });
        build.onEnd(() => {
          buildCount++;
          // first build after main/preload/hiddenWindows is built
          if (buildCount === 3) {
            console.log('[Dev Build] Build complete, start Electron');
            startElectron();
          } else if (buildCount > 3) {
            console.log(`[Dev Build] Finish rebuilding ${scriptName}, restarting Electron`);
            restartElectronProcess();
          } else {
            console.log(`[Dev Build] Skip restarting Electron for ${scriptName} since it is the first rebuild`);
          }
        });
      },
    });
    const preloadContext = await esbuild.context({
      ...preloadBuildOptions,
      plugins: [restartElectronPlugin('preload')],
    });
    const mainContext = await esbuild.context({
      ...mainBuildOptions,
      plugins: [restartElectronPlugin('main')],
    });
    const hiddenPreloadContext = await esbuild.context({
      ...hiddenBrowserWindowPreloadBuildOptions,
      plugins: [restartElectronPlugin('hidden-browser-window-preload')],
    });

    const restartElectronProcess = () => {
      console.log('[Dev Build] Start restarting Electron');

      if (electronProcess) {
        electronProcess.once('exit', () => {
          console.log('[Dev Build] Electron exited');
          startElectron();
        });

        //Shutdown electron first. Existing debugger inspector will be closed in quit event of the app.
        electronProcess.kill();
      }
    };

    const preloadWatch = await preloadContext.watch();
    const mainWatch = await mainContext.watch();
    const hiddenWindowWatch = await hiddenPreloadContext.watch();
    return Promise.all([preloadWatch, mainWatch, hiddenWindowWatch]);
  }
  const preload = esbuild.build(preloadBuildOptions);
  const hiddenBrowserWindowPreload = esbuild.build(hiddenBrowserWindowPreloadBuildOptions);
  const main = esbuild.build(mainBuildOptions);
  return Promise.all([main, preload, hiddenBrowserWindowPreload]).catch(err => {
    console.error('[Build] Build failed:', err);
  });
}

// Build if ran as a cli script
const isMain = require.main === module;

if (isMain) {
  const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
  const autoRestart = process.argv.includes('--autoRestart');
  build({ mode, autoRestart });
}
