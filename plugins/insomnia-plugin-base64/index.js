module.exports.templateTags = [{
  name: 'base64',
  displayName: 'Base64',
  description: 'encode or decode values',
  args: [
    {
      displayName: 'Action',
      type: 'enum',
      options: [
        {displayName: 'Encode', value: 'encode'},
        {displayName: 'Decode', value: 'decode'}
      ]
    },
    {
      displayName: 'Value',
      type: 'string',
      placeholder: 'My text'
    }
  ],
  run (context, op, text) {
    text = text || '';

    if (op === 'encode') {
      return Buffer.from(text, 'utf8').toString('base64');
    } else if (op === 'decode') {
      return Buffer.from(text, 'base64').toString('utf8');
    } else {
      throw new Error('Unsupported operation "' + op + '". Must be encode or decode.');
    }
  }
}];
