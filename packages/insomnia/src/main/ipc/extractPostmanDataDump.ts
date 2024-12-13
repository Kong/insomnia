import path from 'node:path';

import decompress from 'decompress';

export default async function extractPostmanDataDumpHandler(_event: unknown, dataDumpFilePath: string) {
  let files: decompress.File[];
  try {
    files = await decompress(dataDumpFilePath, undefined, {
      filter: (file: { path: string }) => path.extname(file.path) === '.json',
    });
  } catch (err) {
    return {
      err: `Failed to extract files from the archive, ${err.message}`,
    };
  }
  if (files.length === 0) {
    return {
      err: 'No JSON files found in the archive',
    };
  }
  const archiveJsonFile = files.find(file => path.basename(file.path) === 'archive.json');
  if (!archiveJsonFile) {
    return {
      err: 'No archive.json file found in the archive',
    };
  }
  let archiveJsonData;
  try {
    archiveJsonData = JSON.parse(archiveJsonFile.data.toString());
  } catch (err) {
    return {
      err: 'Failed to parse archive.json file',
    };
  }

  interface FileDetail {
    contentStr: string;
    oriFileName: string;
  }

  const collectionList: FileDetail[] = [];
  const envList: FileDetail[] = [];

  // get collections and environments listed in archive.json
  try {
    files.filter(file => file !== archiveJsonFile).forEach(file => {
      const id = path.basename(file.path, '.json');
      const oriFileName = path.basename(file.path);
      if (id in archiveJsonData.collection) {
        collectionList.push({
          contentStr: file.data.toString(),
          oriFileName,
        });
      } else if (id in archiveJsonData.environment) {
        const fileContentStr = file.data.toString();
        const fileJson = JSON.parse(fileContentStr);
        // Set the scope to environment, because it's not set in the file
        fileJson._postman_variable_scope = 'environment';
        envList.push({
          contentStr: JSON.stringify(fileJson),
          oriFileName,
        });
      }
    });
  } catch (err) {
    return {
      err: 'Failed to parse collection or environment files',
    };
  }

  return {
    data: {
      collectionList,
      envList,
    },
  };
}
