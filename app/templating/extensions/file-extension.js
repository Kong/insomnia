// @flow
import fs from 'fs';

export default {
  name: 'file',
  displayName: 'File',
  description: 'read contents from a file',
  args: [
    {
      displayName: 'Choose File',
      type: 'file'
    }
  ],
  run (context: Object, path: string): string {
    if (!path) {
      throw new Error('No file selected');
    }

    return fs.readFileSync(path, 'utf8');
  }
};
