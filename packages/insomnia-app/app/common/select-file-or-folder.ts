import { OpenDialogOptions, remote } from 'electron';
interface Options {
  itemTypes?: Array<'file' | 'directory'>;
  extensions?: Array<string>;
}
interface FileSelection {
  filePath: string;
  canceled: boolean;
}

const selectFileOrFolder = async ({ itemTypes, extensions }: Options): Promise<FileSelection> => {
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
    title: title,
    buttonLabel: 'Select',
    // @ts-expect-error we should update this to accept other properties types as well, which flow all the way up to plugins
    properties: types.map(type => {
      if (type === 'file') {
        return 'openFile';
      }

      if (type === 'directory') {
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
  return {
    filePath: filePaths[0],
    canceled,
  };
};

export default selectFileOrFolder;
