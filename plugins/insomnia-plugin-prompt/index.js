const crypto = require('crypto');

module.exports.templateTags = [
  {
    displayName: 'Prompt',
    name: 'prompt',
    description: 'prompt user for input',
    disablePreview: args => args[4] && args[4].value === true,
    args: [
      {
        displayName: 'Title',
        type: 'string',
        help: 'Title is a unique string used to identify the prompt value',
        validate: v => (v ? '' : 'Required'),
      },
      {
        displayName: 'Label',
        type: 'string',
      },
      {
        displayName: 'Default Value',
        type: 'string',
        help:
          'This value is used to pre-populate the prompt dialog, but is ALSO used ' +
          'when the app renders preview values (like the one below). This is to prevent the ' +
          'prompt from displaying too frequently during general app use.',
      },
      {
        displayName: 'Storage Key',
        type: 'string',
        help:
          'If this is set, the value will be stored in memory under this key until the app is ' +
          "closed. To force this tag to re-prompt the user, simply change this key's value to " +
          'something else.',
      },
      {
        displayName: 'Mask Text',
        type: 'boolean',
        help: 'If this is enabled, the value when input will be masked like a password field.',
        defaultValue: false,
      },
      {
        displayName: 'Prompt for a Value...',
        type: 'enum',
        help:
          'Controls when this prompt should be shown and what value should be used to ' +
          'pre-populate the prompt dialog',
        options: [
          { displayName: 'on each request', value: 'always-fresh' },
          { displayName: 'on each request, using the default value as default', value: 'always-default' },
          { displayName: 'on each request, using the stored value as default', value: 'always-storage' },
          { displayName: 'at most once, storing the value for further requests', value: 'once-storage' },
        ],
      },
    ],
    async run(context, title, label, defaultValue, explicitStorageKey, maskText, showCondition) {
      if (!title) {
        throw new Error('Title attribute is required for prompt tag');
      }

      // Backward compatibility with "Default to Last Value" #1597
      if (showCondition === true) {
          showCondition = 'always-storage';
      } else if (showCondition === false) {
          showCondition = 'always-fresh';
      }

      // If we don't have a key, default to request ID and title
      // We do this because we may render the prompt multiple times per request.
      // We cache it under the requestId.title so it only prompts once. We then
      // clear the cache in a response hook when the request is sent.
      const titleHash = crypto
        .createHash('md5')
        .update(title)
        .digest('hex');
      const storageKey = explicitStorageKey || `${context.meta.requestId}.${titleHash}`;
      const cachedValue = await context.store.getItem(storageKey);

      if (showCondition === 'once-storage' && cachedValue !== null) {
          console.log(`[prompt] Used cached value under ${storageKey}`);
          return cachedValue;
      }

      if (showCondition === 'always-fresh') {
          defaultValue = '';
      } else if (showCondition === 'always-storage') {
          defaultValue = cachedValue;
      }

      // Only prompt when we're actually sending
      if (context.renderPurpose !== 'send') {
        if (showCondition === 'once-storage' && cachedValue !== null) {
          return cachedValue;
        } else {
          return defaultValue || '';
        }
      }

      const value = await context.app.prompt(title || 'Enter Value', {
        label,
        defaultValue,
        selectText: true,
        inputType: maskText ? 'password' : 'text',
      });

      if (storageKey) {
        console.log(`[prompt] Stored value under ${storageKey}`);
        await context.store.setItem(storageKey, value);
      }

      return value;
    },
  },
];
