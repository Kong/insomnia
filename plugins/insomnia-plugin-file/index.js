const fs = require('fs');

module.exports.templateTags = [{
  name: 'file',
  displayName: 'File',
  description: 'read contents from a file',
  args: [
    {
      displayName: 'Choose File',
      type: 'file'
    }
  ],
  run (context, path) {
    if (!path) {
      throw new Error('No file selected');
    }

    return fs.readFileSync(path, 'utf8');
  }
}];
