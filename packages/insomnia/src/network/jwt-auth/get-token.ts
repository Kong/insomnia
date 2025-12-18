import * as crypto from 'node:crypto';

import type { AuthTypeJwt, JwtSigningAlgorithm } from '../../models/request';

const SUPPORTED_ALGORITHMS: JwtSigningAlgorithm[] = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
];

const base64UrlEncode = (buffer: Uint8Array) =>
  Buffer.from(buffer)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const parseJsonObject = (value: string | undefined, fieldName: string) => {
  const raw = value?.trim();
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[jwt] Invalid JSON in ${fieldName}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[jwt] ${fieldName} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
};

const maybeDecodeDataUri = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:')) {
    return value;
  }

  const commaAt = trimmed.indexOf(',');
  if (commaAt === -1) {
    return value;
  }

  const metadata = trimmed.slice(0, commaAt);
  const data = trimmed.slice(commaAt + 1);
  const isBase64 = metadata.includes(';base64');
  return isBase64 ? Buffer.from(data, 'base64').toString('utf8') : decodeURIComponent(data);
};

const isHmacAlgorithm = (algorithm: JwtSigningAlgorithm) => algorithm.startsWith('HS');
const hashForAlgorithm = (algorithm: JwtSigningAlgorithm) => {
  if (algorithm.endsWith('256')) {
    return 'sha256';
  }

  if (algorithm.endsWith('384')) {
    return 'sha384';
  }

  return 'sha512';
};

export const getJwtToken = (authentication: AuthTypeJwt): string => {
  const algorithmRaw = (authentication.algorithm || 'HS256') as string;
  if (!SUPPORTED_ALGORITHMS.includes(algorithmRaw as JwtSigningAlgorithm)) {
    throw new Error(`[jwt] Unsupported algorithm: ${algorithmRaw}`);
  }

  const algorithm = algorithmRaw as JwtSigningAlgorithm;
  const jwtHeaders = parseJsonObject(authentication.header, 'JWT headers');
  const payload = parseJsonObject(authentication.payload, 'JWT payload');

  const header = {
    typ: 'JWT',
    ...jwtHeaders,
    alg: algorithm,
  };

  const signingInput = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(
    Buffer.from(JSON.stringify(payload)),
  )}`;

  const hash = hashForAlgorithm(algorithm);

  if (isHmacAlgorithm(algorithm)) {
    const rawSecret = authentication.secret?.trim() || '';
    if (!rawSecret) {
      throw new Error('[jwt] Secret is required for HS* algorithms');
    }

    const secret = authentication.isSecretBase64Encoded ? Buffer.from(rawSecret, 'base64') : Buffer.from(rawSecret);
    const signature = crypto.createHmac(hash, secret).update(signingInput).digest();
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  const privateKeyRaw = authentication.privateKey?.trim() || '';
  if (!privateKeyRaw) {
    throw new Error('[jwt] Private key is required for RS*, PS* and ES* algorithms');
  }

  const privateKey = maybeDecodeDataUri(privateKeyRaw);
  const signatureOptions = { key: privateKey };
  const isEcdsa = algorithm.startsWith('ES');
  const isPss = algorithm.startsWith('PS');

  const signature = crypto.sign(hash, Buffer.from(signingInput), {
    ...signatureOptions,
    ...(isEcdsa ? { dsaEncoding: 'ieee-p1363' as const } : {}),
    ...(isPss
      ? { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST }
      : {}),
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
};
