// @flow
import * as electron from 'electron';
import {showAlert} from '../../ui/components/modals/index';

export function init (plugin: string): {app: Object} {
  return {
    app: {
      alert (message: string): Promise<void> {
        return showAlert({title: `Plugin ${plugin}`, message});
      },
      getPath (name: string): string {
        switch (name.toLowerCase()) {
          case 'desktop':
            return electron.remote.app.getPath('desktop');
          default:
            throw new Error(`Unknown path name ${name}`);
        }
      }
    }
  };
}
