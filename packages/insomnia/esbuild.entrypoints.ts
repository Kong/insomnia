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
        'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:${PORT}`),
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
    entryPoints: ['./src/entry.preload.ts'],
    outfile: path.join(outdir, 'entry.preload.min.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
  };

  const hiddenBrowserWindowPreloadBuildOptions: BuildOptions = {
    entryPoints: ['./src/entry.hidden-window-preload.ts'],
    outfile: path.join(outdir, 'entry.hidden-window-preload.min.js'),
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

  const hiddenBrowserWindowBuildOptions: BuildOptions = {
    entryPoints: ['./src/entry.hidden-window.ts'],
    outfile: path.join(outdir, 'entry.hidden-window.min.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    // TODO: remove below, This indicates that libcurl is being imported when it shouldn't be
    external: ['electron'],
    loader: {
      '.node': 'copy',
    },
  };

  const pluginWindowBuildOptions: BuildOptions = {
    entryPoints: ['./src/entry.plugin-window.ts'],
    outfile: path.join(outdir, 'entry.plugin-window.min.js'),
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

  const pluginWindowPreloadBuildOptions: BuildOptions = {
    entryPoints: ['./src/entry.plugin-window-preload.ts'],
    outfile: path.join(outdir, 'entry.plugin-window-preload.min.js'),
    target: 'esnext',
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    external: ['electron'],
  };

  const mainBuildOptions: BuildOptions = {
    entryPoints: ['./src/entry.main.ts'],
    outfile: path.join(outdir, 'entry.main.min.js'),
    bundle: true,
    platform: 'node',
    sourcemap: true,
    format: 'cjs',
    define: {
      ...env,
      // Electron main = "browser"
      'process.type': '"browser"',
    },
    external: [
      'electron',
      '@getinsomnia/node-libcurl',
      'fsevents',
      '@node-llama-cpp/mac-arm64-metal',
      '@node-llama-cpp/mac-x64',
      '@node-llama-cpp/linux-arm64',
      '@node-llama-cpp/linux-armv7l',
      '@node-llama-cpp/linux-x64',
      '@node-llama-cpp/linux-x64-cuda',
      '@node-llama-cpp/linux-x64-cuda-ext',
      '@node-llama-cpp/linux-x64-vulkan',
      '@node-llama-cpp/win-arm64',
      '@node-llama-cpp/win-x64',
      '@node-llama-cpp/win-x64-cuda',
      '@node-llama-cpp/win-x64-cuda-ext',
      '@node-llama-cpp/win-x64-vulkan',
      '@reflink/reflink-darwin-arm64',
      '@reflink/reflink-darwin-x64',
      '@reflink/reflink-linux-arm64-gnu',
      '@reflink/reflink-linux-arm64-musl',
      '@reflink/reflink-linux-x64-gnu',
      '@reflink/reflink-linux-x64-musl',
      '@reflink/reflink-win32-arm64-msvc',
      '@reflink/reflink-win32-x64-msvc',
      'apiconnect-wsdl',
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
          // first build after main/preload/hiddenWindows/pluginWindows is built
          if (buildCount === 6) {
            console.log('[Dev Build] Build complete, start Electron');
            startElectron();
          } else if (buildCount > 6) {
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
    const hiddenBrowserWindowContext = await esbuild.context({
      ...hiddenBrowserWindowBuildOptions,
      plugins: [restartElectronPlugin('hidden-browser-window')],
    });
    const mainContext = await esbuild.context({
      ...mainBuildOptions,
      plugins: [restartElectronPlugin('main')],
    });
    const hiddenPreloadContext = await esbuild.context({
      ...hiddenBrowserWindowPreloadBuildOptions,
      plugins: [restartElectronPlugin('hidden-browser-window-preload')],
    });
    const pluginWindowContext = await esbuild.context({
      ...pluginWindowBuildOptions,
      plugins: [restartElectronPlugin('plugin-window')],
    });
    const pluginWindowPreloadContext = await esbuild.context({
      ...pluginWindowPreloadBuildOptions,
      plugins: [restartElectronPlugin('plugin-window-preload')],
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
    const hiddenWindowWatch = await hiddenBrowserWindowContext.watch();
    const mainWatch = await mainContext.watch();
    const hiddenWindowPreloadWatch = await hiddenPreloadContext.watch();
    const pluginWindowWatch = await pluginWindowContext.watch();
    const pluginWindowPreloadWatch = await pluginWindowPreloadContext.watch();
    return Promise.all([
      preloadWatch,
      hiddenWindowPreloadWatch,
      mainWatch,
      hiddenWindowWatch,
      pluginWindowWatch,
      pluginWindowPreloadWatch,
    ]);
  }
  const preload = esbuild.build(preloadBuildOptions);
  const hiddenBrowserWindow = esbuild.build(hiddenBrowserWindowBuildOptions);
  const hiddenBrowserWindowPreload = esbuild.build(hiddenBrowserWindowPreloadBuildOptions);
  const pluginWindow = esbuild.build(pluginWindowBuildOptions);
  const pluginWindowPreload = esbuild.build(pluginWindowPreloadBuildOptions);
  const main = esbuild.build(mainBuildOptions);
  return Promise.all([
    main,
    preload,
    hiddenBrowserWindow,
    hiddenBrowserWindowPreload,
    pluginWindow,
    pluginWindowPreload,
  ]).catch(err => {
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
