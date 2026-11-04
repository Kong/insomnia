const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const aws4 = require('aws4');

const HCP_TOKEN_URL = 'https://auth.idp.hashicorp.com/oauth2/token';
const HCP_API_URL = 'https://api.cloud.hashicorp.com';
const GCP_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

const secretCache = new Map();

const requestJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} returned ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
};

const pickKey = (value, key) => {
  if (!key) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  const object = typeof value === 'string' ? JSON.parse(value) : value;
  if (!(key in object)) {
    throw new Error(`Secret has no key "${key}"`);
  }
  const picked = object[key];
  return typeof picked === 'string' ? picked : JSON.stringify(picked);
};

// HashiCorp

const vaultHeaders = (credentials, token, config) => ({
  ...(token ? { 'X-Vault-Token': token } : {}),
  ...(credentials.namespace && config?.sendNamespaceViaHeader !== false
    ? { 'X-Vault-Namespace': credentials.namespace }
    : {}),
});

const vaultUrl = (credentials, apiPath, config) => {
  const namespace = credentials.namespace && config?.sendNamespaceViaHeader === false ? `${credentials.namespace}/` : '';
  return `${credentials.serverAddress.replace(/\/+$/, '')}/v1/${namespace}${apiPath}`;
};

const authenticateHashiCorp = async credentials => {
  if (credentials.type === 'cloud') {
    const { access_token, expires_in } = await requestJson(HCP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        audience: HCP_API_URL,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      }),
    });
    return { access_token, expires_at: Date.now() + expires_in * SECONDS };
  }

  if (credentials.authMethod === 'token') {
    await requestJson(vaultUrl(credentials, 'auth/token/lookup-self'), {
      headers: vaultHeaders(credentials, credentials.access_token),
    });
    return { access_token: credentials.access_token };
  }

  const { auth } = await requestJson(vaultUrl(credentials, 'auth/approle/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...vaultHeaders(credentials) },
    body: JSON.stringify({ role_id: credentials.role_id, secret_id: credentials.secret_id }),
  });
  return {
    access_token: auth.client_token,
    ...(auth.lease_duration ? { expires_at: Date.now() + auth.lease_duration * SECONDS } : {}),
  };
};

const getHashiCorpToken = async (context, credential) => {
  const { credentials } = credential;
  if (credentials.access_token && (!credentials.expires_at || credentials.expires_at > Date.now())) {
    return credentials.access_token;
  }
  const result = await authenticateHashiCorp(credentials);
  await context.util.models.cloudCredential.update(credential, { credentials: { ...credentials, ...result } });
  return result.access_token;
};

const readHashiCorp = async (context, credential, config) => {
  const { credentials } = credential;
  const token = await getHashiCorpToken(context, credential);

  if (credentials.type === 'cloud') {
    const { organizationId, projectId, appName, secretName, version } = config;
    const app = `${HCP_API_URL}/secrets/2023-11-28/organizations/${organizationId}/projects/${projectId}/apps/${appName}`;
    const versionPath = version ? `/versions/${version}` : '';
    const { static_version } = await requestJson(`${app}/secrets/${secretName}${versionPath}:open`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return static_version.value;
  }

  const { kvVersion, secretEnginePath, secretName, secretKey, version } = config;
  const engine = secretEnginePath.replace(/^\/+|\/+$/g, '');
  const query = kvVersion === 'v2' && version ? `?version=${version}` : '';
  const apiPath = kvVersion === 'v2' ? `${engine}/data/${secretName}${query}` : `${engine}/${secretName}`;
  const { data } = await requestJson(vaultUrl(credentials, apiPath, config), {
    headers: vaultHeaders(credentials, token, config),
  });
  return pickKey(kvVersion === 'v2' ? data.data : data, secretKey);
};

// AWS

const readIniSection = (content, section) => {
  const values = {};
  let inSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      inSection = line === `[${section}]`;
    } else if (inSection && line.includes('=')) {
      const index = line.indexOf('=');
      values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
  return values;
};

const getAwsKeys = async credentials => {
  if (credentials.type === 'temporary') {
    return credentials;
  }
  if (credentials.type !== 'file') {
    throw new Error('AWS SSO credentials are not supported yet. Use a credentials file or temporary keys.');
  }
  const filePath = credentials.filePath || path.join(os.homedir(), '.aws', 'credentials');
  const section = readIniSection(await fs.readFile(filePath, 'utf8'), credentials.section);
  if (!section.aws_access_key_id) {
    throw new Error(`No AWS keys found for profile "${credentials.section}"`);
  }
  return {
    accessKeyId: section.aws_access_key_id,
    secretAccessKey: section.aws_secret_access_key,
    sessionToken: section.aws_session_token,
  };
};

const sendAwsRequest = async (credentials, service, target, body) => {
  const host = `${service}.${credentials.region}.amazonaws.com`;
  const request = aws4.sign(
    {
      host,
      service,
      region: credentials.region,
      method: 'POST',
      path: '/',
      headers: { 'Content-Type': 'application/x-amz-json-1.1', ...(target ? { 'X-Amz-Target': target } : {}) },
      body,
    },
    await getAwsKeys(credentials),
  );
  return requestJson(`https://${host}/`, { method: 'POST', headers: request.headers, body });
};

const authenticateAws = async credentials => {
  const keys = await getAwsKeys(credentials);
  const body = 'Action=GetCallerIdentity&Version=2011-06-15';
  const host = 'sts.amazonaws.com';
  const request = aws4.sign({ host, service: 'sts', region: 'us-east-1', method: 'POST', path: '/', body }, keys);
  const response = await fetch(`https://${host}/`, { method: 'POST', headers: request.headers, body });
  if (!response.ok) {
    throw new Error(`AWS rejected the credentials: ${await response.text()}`);
  }
  return {};
};

const readAws = async (credential, config) => {
  const { SecretId, VersionId, VersionStage, SecretType, SecretKey } = config;
  const { SecretString } = await sendAwsRequest(
    credential.credentials,
    'secretsmanager',
    'secretsmanager.GetSecretValue',
    JSON.stringify({
      SecretId,
      ...(VersionId ? { VersionId } : {}),
      ...(VersionStage ? { VersionStage } : {}),
    }),
  );
  return SecretType === 'kv' ? pickKey(SecretString, SecretKey) : SecretString;
};

// GCP

const base64Url = value => Buffer.from(value).toString('base64url');

const getGcpToken = async credentials => {
  const key = JSON.parse(await fs.readFile(credentials.serviceAccountKeyFilePath, 'utf8'));
  const issuedAt = Math.floor(Date.now() / SECONDS);
  const unsigned = [
    base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64Url(
      JSON.stringify({
        iss: key.client_email,
        scope: GCP_SCOPE,
        aud: key.token_uri,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    ),
  ].join('.');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const { access_token } = await requestJson(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  return access_token;
};

const readGcp = async (credential, { secretName, version = 'latest' }) => {
  const token = await getGcpToken(credential.credentials);
  const { payload } = await requestJson(
    `https://secretmanager.googleapis.com/v1/${secretName}/versions/${version}:access`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return Buffer.from(payload.data, 'base64').toString('utf8');
};

// Plugin surface

const readers = {
  aws: (_, credential, config) => readAws(credential, config),
  gcp: (_, credential, config) => readGcp(credential, config),
  hashicorp: readHashiCorp,
};

const authenticators = {
  aws: authenticateAws,
  gcp: async credentials => {
    await getGcpToken(credentials);
    return {};
  },
  hashicorp: authenticateHashiCorp,
};

const getCredential = async (context, credentialKey) => {
  const credentialId = credentialKey.startsWith('cloudCred_') ? credentialKey : await context.store.getItem(credentialKey);
  const credential = credentialId && (await context.util.models.cloudCredential.getById(credentialId));
  if (!credential) {
    throw new Error('Select a credential for this secret');
  }
  return credential;
};

const run = async (context, provider, credentialKey, encodedConfig) => {
  const read = readers[provider];
  if (!read) {
    throw new Error(`Unsupported secret provider "${provider}"`);
  }
  const credential = await getCredential(context, credentialKey);
  const config = JSON.parse(Buffer.from(encodedConfig, 'base64').toString('utf8'));
  const { vaultSecretCacheDuration } = await context.util.models.settings.get();

  const cacheKey = `${credential._id}:${encodedConfig}`;
  const cached = secretCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const value = await read(context, credential, config);
  if (vaultSecretCacheDuration > 0) {
    secretCache.set(cacheKey, { value, expiresAt: Date.now() + vaultSecretCacheDuration * MINUTES });
  }
  return value;
};

const authenticate = async (_context, { provider, credentials }) => {
  try {
    const authenticator = authenticators[provider];
    if (!authenticator) {
      throw new Error(`Unsupported secret provider "${provider}"`);
    }
    return { success: true, result: await authenticator(credentials) };
  } catch (error) {
    return { success: false, error: { errorMessage: error.message } };
  }
};

module.exports = {
  templateTags: [
    {
      name: 'vault',
      displayName: 'External Vault',
      description: 'Read a secret from an external secret manager',
      args: [
        {
          displayName: 'Provider',
          type: 'enum',
          options: [
            { displayName: 'AWS Secrets Manager', value: 'aws' },
            { displayName: 'GCP Secret Manager', value: 'gcp' },
            { displayName: 'HashiCorp Vault', value: 'hashicorp' },
          ],
        },
        { displayName: 'Credential', type: 'model', model: 'CloudCredential' },
        {
          displayName: 'Secret',
          type: 'string',
          encoding: 'base64',
          requireSubForm: true,
          defaultValue: Buffer.from('{}').toString('base64'),
        },
      ],
      run,
    },
  ],
  unsafePluginMainActions: [
    { name: 'authenticate', action: authenticate },
    { name: 'clearCache', action: async () => secretCache.clear() },
  ],
};
