interface Options {
  itemTypes?: ('file' | 'directory')[];
  extensions?: string[];
  showHiddenFiles?: boolean;
}

interface FileSelection {
  filePath: string;
  canceled: boolean;
}

export const selectFileOrFolder = async ({ itemTypes, extensions, showHiddenFiles }: Options) => {
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

  const properties: Electron.OpenDialogOptions['properties'] = types.map(type => {
    switch (type) {
      case 'file': {
        return 'openFile';
      }

      case 'directory': {
        return 'openDirectory';
      }

      default: {
        throw new Error(`unrecognized item type: "${type}"`);
      }
    }
  });

  if (showHiddenFiles) {
    properties.push('showHiddenFiles');
  }

  const { canceled, filePaths } = await window.dialog.showOpenDialog({
    title,
    buttonLabel: 'Select',
    properties,
    filters: [
      {
        extensions: extensions?.length ? extensions : ['*'],
        name: '',
      },
    ],
  });

  const fileSelection: FileSelection = {
    filePath: filePaths[0],
    canceled,
  };
  return fileSelection;
};
