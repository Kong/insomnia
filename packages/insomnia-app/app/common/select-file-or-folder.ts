import { OpenDialogOptions, remote } from 'electron';
import { unreachableCase } from 'ts-assert-unreachable';

interface Options {
  itemTypes?: ('file' | 'directory')[];
  extensions?: string[];
}

interface FileSelection {
  filePath: string;
  canceled: boolean;
}

export const selectFileOrFolder = async ({ itemTypes, extensions }: Options) => {
  // If no types are selected then default to just files and not directories
  const types = itemTypes || ['file'];
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

  const options: OpenDialogOptions = {
    title,
    buttonLabel: 'Select',
    properties: types.map(type => {
      switch (type) {
        case 'file':
          return 'openFile';

        case 'directory':
          return 'openDirectory';

        default:
          unreachableCase(type, `unrecognized item type: "${type}"`);
      }
    }),
    // @ts-expect-error https://github.com/electron/electron/pull/29322
    filters: [{
      extensions: (extensions?.length ? extensions : ['*']),
    }],
  };

  const { canceled, filePaths } = await remote.dialog.showOpenDialog(options);
  const fileSelection: FileSelection = {
    filePath: filePaths[0],
    canceled,
  };
  return fileSelection;
};
