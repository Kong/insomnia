// @flow
import { remote } from 'electron';

type Options = {
  itemtypes?: Array<string>,
  extensions?: Array<string>,
};

export default async function chooseFile({ itemtypes, extensions }: Options) {
  // If no types are selected then default to just files and not directories
  const types = itemtypes || ['file'];
  let title = 'Select ';
  if (types.includes('file')) {
    title += ' File';
    if (types.length > 2) {
      title += ' or';
    }
  }
  if (types.includes('directory')) {
    title += ' Directory';
  }
  const options = {
    title: title,
    buttonLabel: 'Select',
    properties: types.map(type => {
      if (type === 'file') {
        return 'openFile';
      }
      if (type === 'directory') {
        return 'openDirectory';
      }
    }),
    filters: [{ name: 'All Files', extensions: ['*'] }],
  };

  // If extensions are provided then filter for just those extensions
  if (extensions) {
    options.filters = [{ name: 'Files', extensions }];
  }

  return new Promise(resolve => {
    remote.dialog.showOpenDialog(options, paths => {
      // Only change the file if a new file was selected
      if (!paths || paths.length === 0) {
        resolve();
      }

      const path = paths[0];
      resolve(path);
    });
  });
}
