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

  const { canceled, filePaths } = await window.dialog.showOpenDialog({
    title,
    buttonLabel: 'Select',
    properties: types.map(type => {
      switch (type) {
        case 'file':
          return 'openFile';

        case 'directory':
          return 'openDirectory';

        default:
          throw new Error(`unrecognized item type: "${type}"`);
      }
    }),
    filters: [{
      extensions: (extensions?.length ? extensions : ['*']),
      name: '',
    }],
  });

  const fileSelection: FileSelection = {
    filePath: filePaths[0],
    canceled,
  };
  return fileSelection;
};
