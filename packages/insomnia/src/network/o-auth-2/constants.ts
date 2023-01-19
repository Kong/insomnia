export const GRANT_TYPE_AUTHORIZATION_CODE = 'authorization_code';
export const GRANT_TYPE_IMPLICIT = 'implicit';
export const GRANT_TYPE_PASSWORD = 'password';
export const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
export const GRANT_TYPE_REFRESH = 'refresh_token';
export type AuthKeys =
    'access_token' |
    'id_token' |
    'client_id' |
    'client_secret' |
    'audience' |
    'resource' |
    'code_challenge' |
    'code_challenge_method' |
    'code_verifier' |
    'code' |
    'nonce' |
    'error' |
    'error_description' |
    'error_uri' |
    'expires_in' |
    'grant_type' |
    'password' |
    'redirect_uri' |
    'refresh_token' |
    'response_type' |
    'scope' |
    'state' |
    'token_type' |
    'username' |
    'xError' |
    'xResponseId';
export const PKCE_CHALLENGE_S256 = 'S256';
export const PKCE_CHALLENGE_PLAIN = 'plain';
