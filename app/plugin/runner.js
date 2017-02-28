import vm from 'vm';

export const HOOK_SEND_PREFLIGHT = 'send::pre-flight';
export const PLUGIN_FUNCTION_LISTEN = 'listen';
const _plugins = [];

export function addPlugin (code) {
  // Define plugin interface
  const plugin = {};

  // Add Node-like module.exports context
  const context = vm.createContext({
    module: {exports: plugin},
    console: {
      log(...args) {
        console.log(...args);
      }
    }
  });

  // Eval the plugin
  vm.runInContext(code, context);

  // Do something with the plugin
  _plugins.push(plugin);
}

export function getPlugins () {
  return _plugins;
}

export async function runPluginHook (hook) {
  for (const plugin of getPlugins()) {
    const listenFn = plugin[PLUGIN_FUNCTION_LISTEN];

    if (typeof listenFn !== 'function') {
      console.log(`PLUGIN ${plugin.config.name} did not implement listen()`);
      continue;
    }

    let pluginReturned = false;
    const runFn = async function (command) {
      if (pluginReturned) {
        throw new Error('Plugin called run() after it finished');
      }

      switch (command.command) {
        case 'request.headers.set':
          console.log('SET HEADER', command.name, command.value);
          // TODO: Set the header somehow...
          break;
        case 'response.body.get':
          return '{"token": "123"}';
        case 'environment.set':
          console.log('SET ENV', command.key, command.value);
          // TODO: Set the environment somehow...
          break;
        default:
          throw new Error(`Plugin ran invalid command ${command.command}`)
      }
    };

    // Actually run the hook
    await listenFn(hook, runFn);
  }
}
