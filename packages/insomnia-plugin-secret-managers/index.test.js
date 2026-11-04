const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, beforeEach, describe, it, mock } = require('node:test');

const plugin = require('./index.js');

const vault = plugin.templateTags[0];
const encode = config => Buffer.from(JSON.stringify(config)).toString('base64');

const makeContext = (credential, settings = {}) => ({
  store: { getItem: async () => credential._id },
  util: {
    models: {
      cloudCredential: { getById: async () => credential, update: mock.fn(async () => credential) },
      settings: { get: async () => settings },
    },
  },
});

const mockFetch = responses => {
  const fetchMock = mock.fn(async url => {
    const match = Object.entries(responses).find(([part]) => String(url).includes(part));
    assert.ok(match, `Unexpected request to ${url}`);
    const [status, body] = Array.isArray(match[1]) ? match[1] : [200, match[1]];
    return new Response(JSON.stringify(body), { status });
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
};

describe('vault tag', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await plugin.unsafePluginMainActions.find(a => a.name === 'clearCache').action();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const onPrem = {
    _id: 'cloudCred_1',
    credentials: { type: 'onPrem', authMethod: 'token', access_token: 'token', serverAddress: 'https://vault.test/' },
  };

  it('reads a KV v2 key from HashiCorp Vault', async () => {
    const fetchMock = mockFetch({ '/v1/secret/data/app': { data: { data: { password: 'hunter2' } } } });

    const value = await vault.run(
      makeContext(onPrem),
      'hashicorp',
      'cloudCred_1',
      encode({ kvVersion: 'v2', secretEnginePath: '/secret/', secretName: 'app', secretKey: 'password' }),
    );

    assert.equal(value, 'hunter2');
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://vault.test/v1/secret/data/app');
    assert.equal(options.headers['X-Vault-Token'], 'token');
  });

  it('reads a KV v1 secret and resolves the credential through the store', async () => {
    mockFetch({ '/v1/kv/app': { data: { a: 1 } } });

    const value = await vault.run(
      makeContext(onPrem),
      'hashicorp',
      'externalVaultTag_abc',
      encode({ kvVersion: 'v1', secretEnginePath: 'kv', secretName: 'app' }),
    );

    assert.equal(value, '{"a":1}');
  });

  it('logs in with AppRole when the token expired and saves it', async () => {
    const credential = {
      _id: 'cloudCred_2',
      credentials: {
        type: 'onPrem',
        authMethod: 'appRole',
        role_id: 'role',
        secret_id: 'secret',
        serverAddress: 'https://vault.test',
        access_token: 'old',
        expires_at: 1,
      },
    };
    const fetchMock = mockFetch({
      'auth/approle/login': { auth: { client_token: 'new', lease_duration: 60 } },
      '/v1/kv/app': { data: { a: 'b' } },
    });
    const context = makeContext(credential);

    await vault.run(context, 'hashicorp', 'cloudCred_2', encode({ kvVersion: 'v1', secretEnginePath: 'kv', secretName: 'app', secretKey: 'a' }));

    assert.equal(fetchMock.mock.calls[1].arguments[1].headers['X-Vault-Token'], 'new');
    assert.equal(context.util.models.cloudCredential.update.mock.calls[0].arguments[1].credentials.access_token, 'new');
  });

  it('signs AWS requests and picks a JSON key', async () => {
    const fetchMock = mockFetch({ 'secretsmanager.eu-west-1': { SecretString: '{"db":"pass"}' } });
    const credential = {
      _id: 'cloudCred_3',
      credentials: { type: 'temporary', accessKeyId: 'AK', secretAccessKey: 'SK', sessionToken: 'ST', region: 'eu-west-1' },
    };

    const value = await vault.run(makeContext(credential), 'aws', 'cloudCred_3', encode({ SecretId: 'app', SecretType: 'kv', SecretKey: 'db' }));

    assert.equal(value, 'pass');
    const { headers } = fetchMock.mock.calls[0].arguments[1];
    assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AK\//);
    assert.equal(headers['X-Amz-Target'], 'secretsmanager.GetSecretValue');
  });

  it('reads AWS keys from a credentials file profile', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-'));
    const filePath = path.join(dir, 'credentials');
    fs.writeFileSync(filePath, '[other]\naws_access_key_id = NO\n\n[work]\naws_access_key_id = FILEKEY\naws_secret_access_key = SK\n');
    const fetchMock = mockFetch({ secretsmanager: { SecretString: 'plain' } });
    const credential = { _id: 'cloudCred_4', credentials: { type: 'file', section: 'work', filePath, region: 'us-east-1' } };

    await vault.run(makeContext(credential), 'aws', 'cloudCred_4', encode({ SecretId: 'app', SecretType: 'plaintext' }));

    assert.match(fetchMock.mock.calls[0].arguments[1].headers.Authorization, /Credential=FILEKEY\//);
    fs.rmSync(dir, { recursive: true });
  });

  it('signs a GCP service account token and decodes the secret', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcp-'));
    const keyFile = path.join(dir, 'key.json');
    fs.writeFileSync(
      keyFile,
      JSON.stringify({
        client_email: 'sa@test',
        token_uri: 'https://oauth.test/token',
        private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      }),
    );
    const fetchMock = mockFetch({
      'oauth.test/token': { access_token: 'gcp-token' },
      'secretmanager.googleapis.com': { payload: { data: Buffer.from('s3cret').toString('base64') } },
    });
    const credential = { _id: 'cloudCred_5', credentials: { serviceAccountKeyFilePath: keyFile } };

    const value = await vault.run(makeContext(credential), 'gcp', 'cloudCred_5', encode({ secretName: 'projects/p/secrets/s' }));

    assert.equal(value, 's3cret');
    const assertion = fetchMock.mock.calls[0].arguments[1].body.get('assertion');
    const [header, claims, signature] = assertion.split('.');
    assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')));
    assert.equal(fetchMock.mock.calls[1].arguments[1].headers.Authorization, 'Bearer gcp-token');
    fs.rmSync(dir, { recursive: true });
  });

  it('caches values when caching is on and clears on request', async () => {
    const fetchMock = mockFetch({ '/v1/kv/app': { data: { a: 'b' } } });
    const context = makeContext(onPrem, { vaultSecretCacheDuration: 5 });
    const config = encode({ kvVersion: 'v1', secretEnginePath: 'kv', secretName: 'app', secretKey: 'a' });

    await vault.run(context, 'hashicorp', 'cloudCred_1', config);
    await vault.run(context, 'hashicorp', 'cloudCred_1', config);
    assert.equal(fetchMock.mock.calls.length, 1);

    await plugin.unsafePluginMainActions.find(a => a.name === 'clearCache').action();
    await vault.run(context, 'hashicorp', 'cloudCred_1', config);
    assert.equal(fetchMock.mock.calls.length, 2);
  });

  it('reports authentication failures in the shape the UI reads', async () => {
    mockFetch({ 'lookup-self': [403, { errors: ['denied'] }] });
    const authenticate = plugin.unsafePluginMainActions.find(a => a.name === 'authenticate').action;

    const result = await authenticate({}, { provider: 'hashicorp', credentials: onPrem.credentials });

    assert.equal(result.success, false);
    assert.match(result.error.errorMessage, /403/);
  });
});
