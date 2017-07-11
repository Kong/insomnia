import * as electron from 'electron';
import {showAlert} from '../../ui/components/modals/index';

export function init (plugin) {
  return {
    app: {
      async alert (message) {
        showAlert({title: `Plugin ${plugin.name}`, message});
      },
      getPath (name) {
        if (name.toLowerCase() === 'desktop') {
          return electron.remote.app.getPath('desktop');
        }

        throw new Error(`Unknown path name ${name}`);
      }
    }
  };
}
