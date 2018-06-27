const tag = require('..').templateTags[0];

function assertTemplate(args, expected) {
  return async function() {
    const result = await tag.run(null, ...args);
    expect(result).toBe(expected);
  };
}

function assertTemplateFails(args, expected) {
  return async function() {
    try {
      await tag.run(null, ...args);
      fail(`Render should have thrown ${expected}`);
    } catch (err) {
      expect(err.message).toContain(expected);
    }
  };
}

describe('Plugin', () => {
  // Algorithms
  it(
    'hashes sha1',
    assertTemplate(
      ['sha1', 'hex', 'foo'],
      '0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33'
    )
  );
  it(
    'hashes sha256',
    assertTemplate(
      ['sha256', 'hex', 'foo'],
      '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
    )
  );
  it(
    'hashes md5',
    assertTemplate(['md5', 'hex', 'foo'], 'acbd18db4cc2f85cedef654fccc4a4d8')
  );
  it(
    'fails to hash invalid algorithm',
    assertTemplateFails(['bad', 'hex', 'foo'], 'Digest method not supported')
  );

  // Digests
  it(
    'hashes to latin1',
    assertTemplate(['md5', 'latin1', 'foo'], '¬½ÛLÂø\\íïeOÌÄ¤Ø')
  );
  it(
    'hashes to hex',
    assertTemplate(['md5', 'hex', 'foo'], 'acbd18db4cc2f85cedef654fccc4a4d8')
  );
  it(
    'hashes to base64',
    assertTemplate(['md5', 'base64', 'foo'], 'rL0Y20zC+Fzt72VPzMSk2A==')
  );
  it(
    'fails to hash to invalid',
    assertTemplateFails(
      ['md5', 'bad', 'foo'],
      'Invalid encoding bad. Choices are hex, latin1, base64'
    )
  );

  // Values
  it(
    'hashes empty string',
    assertTemplate(['md5', 'hex', ''], 'd41d8cd98f00b204e9800998ecf8427e')
  );
  it(
    'hashes no string',
    assertTemplate(['md5', 'hex'], 'd41d8cd98f00b204e9800998ecf8427e')
  );
  it(
    'fails to hash non string',
    assertTemplateFails(
      ['md5', 'hex', true],
      'Cannot hash value of type "boolean"'
    )
  );
});
