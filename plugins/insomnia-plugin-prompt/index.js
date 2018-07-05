module.exports.requestHooks = [
  context => {
    const requestId = context.request.getId();

    // Delete cached values we prompt again on the next request
    context.store.clear();
  }
];

module.exports.templateTags = [
  {
    displayName: 'Prompt',
    name: 'prompt',
    description: 'prompt user for input',
    args: [
      {
        displayName: 'Title',
        type: 'string',
        help: 'Title is a unique string used to identify the prompt value',
        validate: v => (v ? '' : 'Required')
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
      },
      {
        displayName: 'Mask Text',
        type: 'boolean',
        help:
          'If this is enabled, the value when input will be masked like a password field.',
        defaultValue: false
      }
    ],
    async run(
      context,
      title,
      label,
      defaultValue,
      explicitStorageKey,
      maskText
    ) {
      if (!title) {
        throw new Error('Title attribute is required for prompt tag');
      }

      // If we don't have a key, default to request ID.
      // We do this because we may render the prompt multiple times per request.
      // We cache it under the requestId so it only prompts once. We then clear
      // the cache in a response hook when the request is sent.
      const storageKey =
        explicitStorageKey || `${context.meta.requestId}.${title}`;
      const cachedValue = await context.store.getItem(storageKey);

      if (cachedValue) {
        console.log(`[prompt] Used cached value under ${storageKey}`);
        return cachedValue;
      }

      const value = await context.app.prompt(title || 'Enter Value', {
        label,
        defaultValue,
        inputType: maskText ? 'password' : 'text'
      });

      if (storageKey) {
        console.log(`[prompt] Stored value under ${storageKey}`);
        await context.store.setItem(storageKey, value);
      }

      return value;
    }
  }
];
