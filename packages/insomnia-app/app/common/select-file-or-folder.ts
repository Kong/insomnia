import { OpenDialogOptions, remote } from 'electron';

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
      }
    }),
    filters: [
      {
        name: 'All Files',
        extensions: ['*'],
      },
    ],
  };

  // If extensions are provided then filter for just those extensions
  if (extensions?.length) {
    options.filters = [
      {
        name: 'Files',
        extensions: extensions,
      },
    ];
  }

  const { canceled, filePaths } = await remote.dialog.showOpenDialog(options);
  const fileSelection: FileSelection = {
    filePath: filePaths[0],
    canceled,
  };
  return fileSelection;
};
