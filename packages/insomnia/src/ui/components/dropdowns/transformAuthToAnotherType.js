export function makeNewAuth(type, oldAuth = {}) {
  switch (type) {
    // No Auth
    case 'none':
      return { type: 'none' };

    // API Key Authentication
    case 'apikey':
      return {
        type,
        disabled: oldAuth.disabled || false,
        key: oldAuth.key || '',
        value: oldAuth.value || '',
        addTo: oldAuth.addTo || 'header',
      };

    // HTTP Basic Authentication
    case 'basic':
      return {
        type,
        useISO88591: oldAuth.useISO88591 || false,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case 'digest':
    case 'ntlm':
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case 'oauth1':
      return {
        type,
        disabled: false,
        signatureMethod: SIGNATURE_METHOD_HMAC_SHA1,
        consumerKey: '',
        consumerSecret: '',
        tokenKey: '',
        tokenSecret: '',
        privateKey: '',
        version: '1.0',
        nonce: '',
        timestamp: '',
        callback: '',
      };

    // OAuth 2.0
    case 'oauth2':
      return {
        type,
        grantType: GRANT_TYPE_AUTHORIZATION_CODE,
      };

    // Aws IAM
    case 'iam':
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || '',
        sessionToken: oldAuth.sessionToken || '',
      };

    // Hawk
    case 'hawk':
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256,
      };

    // Atlassian ASAP
    case 'asap':
      return {
        type,
        issuer: '',
        subject: '',
        audience: '',
        additionalClaims: '',
        keyId: '',
        privateKey: '',
      };

    // Types needing no defaults
    case 'netrc':
    default:
      return {
        type,
      };
  }
}
