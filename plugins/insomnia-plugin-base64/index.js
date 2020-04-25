module.exports.templateTags = [
  {
    name: 'base64',
    displayName: 'Base64',
    description: 'encode or decode values',
    args: [
      {
        displayName: 'Action',
        type: 'enum',
        options: [
          { displayName: 'Encode', value: 'encode' },
          { displayName: 'Decode', value: 'decode' },
        ],
      },
      {
        displayName: 'Kind',
        type: 'enum',
        options: [{ displayName: 'Normal', value: 'normal' }, { displayName: 'URL', value: 'url' }],
      },
      {
        displayName: 'Value',
        type: 'string',
        placeholder: 'My text',
      },
    ],
    run(context, action, kind, text) {
      text = text || '';

      if (action === 'encode') {
        if (kind === 'normal') {
          return Buffer.from(text, 'utf8').toString('base64');
        } else if (kind === 'url') {
          return Buffer.from(text, 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        }
      } else if (action === 'decode') {
        return Buffer.from(text, 'base64').toString('utf8');
      } else {
        throw new Error('Unsupported operation "' + action + '". Must be encode or decode.');
      }
    },
  },
];
