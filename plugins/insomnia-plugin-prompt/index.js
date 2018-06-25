const STORE = {};
module.exports.templateTags = [
  {
    displayName: 'Prompt',
    name: 'prompt',
    description: 'prompt user for input',
    args: [
      {
        displayName: 'Title',
        type: 'string'
      },
      {
        displayName: 'Label',
        type: 'string'
      },
      {
        displayName: 'Default Value',
        type: 'string',
        help:
          'This value is used to pre-populate the prompt dialog, but is ALSO used ' +
          'when the app renders preview values (like the one below). This is to prevent the ' +
          'prompt from displaying too frequently during general app use.'
      },
      {
        displayName: 'Storage Key',
        type: 'string',
        help:
          'If this is set, the value will be stored in memory under this key until the app is ' +
          "closed. To force this tag to re-prompt the user, simply change this key's value to " +
          'something else.'
      }
    ],
    async run(context, title, label, defaultValue, storageKey) {
      if (STORE[storageKey]) {
        console.log(`[prompt] Used cached value under ${storageKey}`);
        return STORE[storageKey];
      }

      const value = await context.app.prompt(title || 'Enter Value', {
        label,
        defaultValue
      });

      // Store if a key is set
      if (storageKey) {
        console.log(`[prompt] Stored value under ${storageKey}`);
        STORE[storageKey] = value;
      }

      return value;
    }
  }
];
