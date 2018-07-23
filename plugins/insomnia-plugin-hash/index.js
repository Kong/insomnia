const crypto = require('crypto');

module.exports.templateTags = [
  {
    name: 'hash',
    displayName: 'Hash',
    description: 'apply hash to a value',
    args: [
      {
        displayName: 'Algorithm',
        type: 'enum',
        options: [
          { displayName: 'MD5', value: 'md5' },
          { displayName: 'SHA1', value: 'sha1' },
          { displayName: 'SHA256', value: 'sha256' },
          { displayName: 'SHA512', value: 'sha512' }
        ]
      },
      {
        displayName: 'Digest Encoding',
        description: 'The encoding of the output',
        type: 'enum',
        options: [
          { displayName: 'Hexadecimal', value: 'hex' },
          { displayName: 'Base64', value: 'base64' }
        ]
      },
      {
        displayName: 'Input',
        type: 'string',
        placeholder: 'Value to hash'
      }
    ],
    run(context, algorithm, encoding, value = '') {
      if (
        encoding !== 'hex' &&
        encoding !== 'latin1' &&
        encoding !== 'base64'
      ) {
        throw new Error(
          `Invalid encoding ${encoding}. Choices are hex, latin1, base64`
        );
      }

      const valueType = typeof value;
      if (valueType !== 'string') {
        throw new Error(`Cannot hash value of type "${valueType}"`);
      }

      const hash = crypto.createHash(algorithm);
      hash.update(value || '', 'utf8');
      return hash.digest(encoding);
    }
  }
];
