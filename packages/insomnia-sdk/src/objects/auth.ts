import type { OAuth2ResponseType, RequestAuthentication } from 'insomnia/src/models/request';
import type { OAuth1SignatureMethod } from 'insomnia/src/network/o-auth-1/constants';

import { Property } from './properties';
import { Variable, VariableList } from './variables';

export type AuthOptionTypes =
    'noauth'
    | 'basic'
    | 'bearer'
    | 'jwt'
    | 'digest'
    | 'oauth1'
    | 'oauth2'
    | 'hawk'
    | 'awsv4'
    | 'ntlm'
    | 'apikey'
    | 'edgegrid'
    | 'asap'
    | 'netrc';
export const AuthTypes = new Set([
    'noauth',
    'basic',
    'bearer',
    'jwt',
    'digest',
    'oauth1',
    'oauth2',
    'hawk',
    'awsv4',
    'ntlm',
    'apikey',
    'edgegrid',
    'asap',
    'netrc',
]);

export interface AuthOption {
    key: string;
    value: string;
    type?: string;
}

export interface OAuth2AuthOption {
    key: string;
    value: string | OAuth2Param[];
    type?: string;
};

export interface BasicOptions {
    password: string;
    username: string;
    id?: string;
}

export interface BearerOptions {
    token: string;
    id?: string;
}

export interface JWTOptions {
    secret: string;
    algorithm: string;
    isSecretBase64Encoded: boolean;
    payload: string; // e.g. "{}"
    addTokenTo: string;
    headerPrefix: string;
    queryParamKey: string;
    header: string; // e.g. "{}"
    id?: string;
}

export interface DigestOptions {
    opaque: string;
    clientNonce: string;
    nonceCount: string;
    qop: string;
    nonce: string;
    realm: string;
    password: string;
    username: string;
    algorithm: string;
    id?: string;
}

export interface OAuth1Options {
    addEmptyParamsToSign: boolean;
    includeBodyHash: boolean;
    realm: string;
    nonce: string;
    timestamp: string;
    verifier: string;
    callback: string;
    tokenSecret: string;
    token: string;
    consumerSecret: string;
    consumerKey: string;
    signatureMethod: string; // "HMAC-SHA1"
    version: string;
    addParamsToHeader: string;
    id?: string;
}

export interface OAuth2Param {
    key: string;
    value: string;
    enabled: boolean;
    send_as: string; // it follows existing naming
}

export interface OAuth2Options {
    accessToken: string;
    refreshRequestParams: OAuth2Param[];
    tokenRequestParams: OAuth2Param[];
    authRequestParams: OAuth2Param[];
    refreshTokenUrl: string;
    state: string;
    scope: string;
    clientSecret: string;
    clientId: string;
    accessTokenUrl: string;
    authUrl: string;
    tokenName: string;
    addTokenTo: string;
    code_verifier: string;
    id?: string;
}

export interface HAWKOptions {
    includePayloadHash: boolean;
    timestamp: string;
    delegation: string;
    app: string;
    extraData: string;
    nonce: string;
    user: string;
    authKey: string;
    authId: string;
    algorithm: string;
    id?: string;
}

export interface AWSV4Options {
    sessionToken: string;
    service: string;
    region: string;
    secretKey: string;
    accessKey: string;
    id?: string;
}

export interface NTLMOptions {
    workstation: string;
    domain: string;
    password: string;
    username: string;
    id?: string;
}

export interface APIKeyOptions {
    key: string;
    value: string;
    id?: string;
}

export interface EdgegridOptions {
    headersToSign: string;
    baseURL: string;
    timestamp: string;
    nonce: string;
    clientSecret: string;
    clientToken: string;
    accessToken: string;
    id?: string;
}

export interface ASAPOptions {
    exp: string; // expiry
    claims: string; // e.g., { "additional claim": "claim value" }
    sub: string; // subject
    privateKey: string; // private key
    kid: string; // key id
    aud: string; // audience
    iss: string; // issuer
    alg: string; // e.g., RS256
    id?: string;
}

export function authOptionsToParams(
    authMethod: BasicOptions | BearerOptions | JWTOptions | DigestOptions | OAuth1Options | OAuth2Options | HAWKOptions | AWSV4Options | NTLMOptions | APIKeyOptions | EdgegridOptions | ASAPOptions
) {
    return Object.entries(authMethod).
        map(entry => ({
            type: 'any',
            key: entry[0],
            value: entry[1],
        }));
}
export interface AuthOptions {
    type: AuthOptionTypes;
    basic?: AuthOption[];
    bearer?: AuthOption[];
    jwt?: AuthOption[];
    digest?: AuthOption[];
    oauth1?: AuthOption[];
    oauth2?: OAuth2AuthOption[];
    hawk?: AuthOption[];
    awsv4?: AuthOption[];
    ntlm?: AuthOption[];
    apikey?: AuthOption[];
    edgegrid?: AuthOption[];
    asap?: AuthOption[];
}

function rawOptionsToVariables(options: VariableList<Variable> | Variable[] | AuthOptions, targetType?: string): VariableList<Variable>[] {
    if (VariableList.isVariableList(options)) {
        return [options as VariableList<Variable>];
    } else if ('type' in options) {
        // options is AuthOptions
        const optsObj = options as AuthOptions;
        const optsVarLists = Object.entries(optsObj)
            .filter(optsObjEntry => {
                return optsObjEntry[0] === targetType;
            })
            .map(optsEntry => {
                const optVars = optsEntry[1].map((opt: AuthOption) => {
                    return new Variable({
                        key: opt.key,
                        value: opt.value,
                    });
                });
                return new VariableList(undefined, optVars);
            });

        return optsVarLists;
    } else if ('length' in options) { // array
        return [new VariableList(undefined, options)];
    }

    throw Error('options is not valid: it must be VariableList<Variable> | Variable[] | object');
}

export class RequestAuth extends Property {
    private type: AuthOptionTypes;
    private authOptions: Map<string, VariableList<Variable>> = new Map();

    constructor(options: AuthOptions, parent?: Property) {
        super();

        if (!RequestAuth.isValidType(options.type)) {
            throw Error(`invalid auth type ${options.type}`);
        }

        this.type = options.type;
        const optsObj = options as AuthOptions;
        const optsEntries = Object.entries(optsObj)
            .filter(optsObjEntry => optsObjEntry[0] !== 'type');

        optsEntries.map((optsEntry: [string, AuthOption[]]) => {
            const optVars = optsEntry[1]
                .map(opt => {
                    return new Variable({
                        key: opt.key,
                        value: opt.value,
                        type: opt.type,
                    });
                });

            return {
                type: optsEntry[0],
                options: new VariableList(undefined, optVars),
            };
        })
            .forEach(authOpts => {
                this.authOptions.set(authOpts.type, authOpts.options);
            });

        this._parent = parent;
    }

    static isValidType(authType: string) {
        return AuthTypes.has(authType);
    }

    clear(type: string) {
        if (RequestAuth.isValidType(type)) {
            this.authOptions.delete(type);
        }
    }

    parameters(): VariableList<Variable> | undefined {
        return this.authOptions.get(this.type);
    }

    override toJSON() {
        const obj: AuthOptions = { type: this.type };
        const authOption = this.authOptions.get(this.type);
        if (!authOption) {
            return obj;
        }

        if (this.type === 'noauth' || this.type === 'netrc') {
            return obj;
        }
        obj[this.type] = authOption.map(optValue => optValue.toJSON(), {});
        return obj;
    }

    update(options: VariableList<Variable> | Variable[] | AuthOptions, type?: AuthOptionTypes) {
        const currentType = type ? type : this.type;
        const authOpts = rawOptionsToVariables(options, currentType);

        if (authOpts.length > 0 && authOpts[0]) {
            this.type = currentType;
            this.authOptions.set(currentType, authOpts[0]);
        } else {
            throw Error('no valid RequestAuth options is found');
        }
    }

    use(type: AuthOptionTypes, options: VariableList<Variable> | Variable[] | AuthOptions) {
        if (!RequestAuth.isValidType(type)) {
            throw Error(`invalid type (${type}), it must be noauth | basic | bearer | jwt | digest | oauth1 | oauth2 | hawk | awsv4 | ntlm | apikey | edgegrid | asap.`);
        }

        const authOpts = rawOptionsToVariables(options, type);
        if (authOpts.length > 0 && authOpts[0]) {
            this.type = type;
            this.authOptions.set(type, authOpts[0]);
        } else {
            throw Error('no valid RequestAuth options is found');
        }
    }
}

export function fromPreRequestAuth(auth: RequestAuth): RequestAuthentication {
    const authObj = auth.toJSON();

    const findValueInKvArray = (targetKey: string, kvs?: { key: string; value: string }[]) =>
        kvs?.find(({ key }) => key === targetKey)?.value || '';

    const findValueInOauth2Options = (
        targetKey: string,
        kvs?: { key: string; value: string }[] | OAuth2AuthOption[]
    ) => {
        if (!kvs) {
            return '';
        }

        for (const kv of kvs) {
            if (typeof kv.value === 'string' && kv.key === targetKey) {
                return kv.value;
            } else if (Array.isArray(kv.value)) {
                const matched = kv.value.find(subKv => subKv.key === targetKey);
                if (matched != null) {
                    return matched.value;
                }
            }
        }

        return '';
    };

    switch (authObj.type) {
        case 'noauth':
            return {
                type: 'none',
                disabled: true,
            };
        case 'apikey':
            return {
                type: 'apikey',
                disabled: findValueInKvArray('disabled', authObj.apikey) === 'true',
                key: findValueInKvArray('key', authObj.apikey),
                value: findValueInKvArray('value', authObj.apikey),
                addTo: findValueInKvArray('in', authObj.apikey),
            };
        case 'bearer':
            return {
                type: 'bearer',
                disabled: findValueInKvArray('disabled', authObj.bearer) === 'true',
                token: findValueInKvArray('token', authObj.bearer),
                prefix: findValueInKvArray('prefix', authObj.bearer),
            };
        case 'basic':
            return {
                type: 'basic',
                disabled: findValueInKvArray('disabled', authObj.basic) === 'true',
                useISO88591: findValueInKvArray('useISO88591', authObj.basic) === 'true',
                username: findValueInKvArray('username', authObj.basic),
                password: findValueInKvArray('password', authObj.basic),
            };
        case 'digest':
            return {
                type: 'digest',
                disabled: findValueInKvArray('disabled', authObj.digest) === 'true',
                username: findValueInKvArray('username', authObj.digest),
                password: findValueInKvArray('password', authObj.digest),
            };
        case 'ntlm':
            return {
                type: 'ntlm',
                disabled: findValueInKvArray('disabled', authObj.ntlm) === 'true',
                username: findValueInKvArray('username', authObj.ntlm),
                password: findValueInKvArray('password', authObj.ntlm),
            };
        case 'oauth1':
            const signMethod = ((): OAuth1SignatureMethod => {
                const method = findValueInKvArray('signatureMethod', authObj.oauth1);
                const unsupportedError = Error(`auth transforming(fromPreRequestAuth): unsupported signatureMethod type for oauth1: ${method}`);
                switch (method) {
                    case 'HMAC-SHA1':
                        return 'HMAC-SHA1';
                    case 'HMAC-SHA256':
                        return 'HMAC-SHA256';
                    case 'HMAC-SHA512':
                        throw unsupportedError;
                    case 'RSA-SHA1':
                        return 'RSA-SHA1';
                    case 'RSA-SHA256':
                        throw unsupportedError;
                    case 'RSA-SHA512':
                        throw unsupportedError;
                    case 'PLAINTEXT':
                        return 'PLAINTEXT';
                    default:
                        throw Error(`auth transforming(fromPreRequestAuth): unknown signatureMethod type for oauth1: ${method}`);
                }
            })();

            return {
                type: 'oauth1',
                disabled: findValueInKvArray('disabled', authObj.oauth1) === 'true',
                signatureMethod: signMethod,
                consumerKey: findValueInKvArray('consumerKey', authObj.oauth1),
                consumerSecret: findValueInKvArray('consumerSecret', authObj.oauth1),
                tokenKey: findValueInKvArray('token', authObj.oauth1),
                tokenSecret: findValueInKvArray('tokenSecret', authObj.oauth1),
                privateKey: findValueInKvArray('privateKey', authObj.oauth1), // it is not supported in the script side
                version: findValueInKvArray('version', authObj.oauth1),
                nonce: findValueInKvArray('nonce', authObj.oauth1),
                timestamp: findValueInKvArray('timestamp', authObj.oauth1),
                callback: findValueInKvArray('callback', authObj.oauth1),
                realm: findValueInKvArray('realm', authObj.oauth1),
                verifier: findValueInKvArray('verifier', authObj.oauth1),
                includeBodyHash: findValueInKvArray('includeBodyHash', authObj.oauth1) === 'true',
            };
        case 'oauth2':
            const inputGrantType = findValueInOauth2Options('grant_type', authObj.oauth2);
            const grantType = (() => {
                switch (inputGrantType) {
                    case 'authorization_code':
                    case 'authorization_code_with_pkce':
                        return 'authorization_code';
                    case 'implicit':
                        return 'implicit';
                    case 'password_credentials':
                        return 'password';
                    case 'client_credentials':
                        return 'client_credentials';
                    case 'refresh_token':
                        return 'refresh_token';
                    default:
                        throw Error(`auth transforming(fromPreRequestAuth): unknown auth grant type for oauth2: ${inputGrantType}`);
                }
            })();

            const responseType = ((): OAuth2ResponseType => {
                const inputResponseType = findValueInOauth2Options('response_type', authObj.oauth2);
                // responseType is currently always set to '' in our request auth model, this should be investigated what is correct to be set
                if (['code', 'id_token', 'id_token token', 'none', 'token', ''].includes(inputResponseType)) {
                    return inputResponseType as OAuth2ResponseType;
                };
                throw Error(`unknown response type for oauth2: "${inputResponseType}", it could be: 'code' | 'id_token' | 'id_token token' | 'none' | 'token' | ''`);
            })();

            return {
                type: 'oauth2',
                disabled: findValueInOauth2Options('disabled', authObj.oauth2) === 'true',
                grantType: grantType,
                authorizationUrl: findValueInOauth2Options('authUrl', authObj.oauth2),
                accessTokenUrl: findValueInOauth2Options('accessTokenUrl', authObj.oauth2),
                clientId: findValueInOauth2Options('clientId', authObj.oauth2),
                clientSecret: findValueInOauth2Options('clientSecret', authObj.oauth2),
                scope: findValueInOauth2Options('scope', authObj.oauth2),
                code: findValueInOauth2Options('code_verifier', authObj.oauth2),
                accessToken: findValueInOauth2Options('accessToken', authObj.oauth2),
                pkceMethod: findValueInOauth2Options('challengeAlgorithm', authObj.oauth2),
                usePkce: findValueInOauth2Options('grant_type', authObj.oauth2) === 'authorization_code_with_pkce',
                username: findValueInOauth2Options('username', authObj.oauth2),
                password: findValueInOauth2Options('password', authObj.oauth2),
                redirectUrl: findValueInOauth2Options('callBackUrl', authObj.oauth2),
                state: findValueInOauth2Options('state', authObj.oauth2),
                refreshToken: findValueInOauth2Options('refreshTokenUrl', authObj.oauth2),
                credentialsInBody: findValueInOauth2Options('client_authentication', authObj.oauth2) === 'body',
                audience: findValueInOauth2Options('audience', authObj.oauth2) || '',
                resource: findValueInOauth2Options('resource', authObj.oauth2) || '',
                // following properties are not supported yet in the script side, just try to find and set them
                tokenPrefix: findValueInOauth2Options('tokenPrefix', authObj.oauth2),
                responseType: responseType,
                origin: findValueInOauth2Options('origin', authObj.oauth2),
            };
        case 'awsv4':
            return {
                type: 'iam',
                disabled: findValueInKvArray('disabled', authObj.awsv4) === 'true',
                accessKeyId: findValueInKvArray('accessKey', authObj.awsv4),
                secretAccessKey: findValueInKvArray('secretKey', authObj.awsv4),
                sessionToken: findValueInKvArray('sessionToken', authObj.awsv4),
                region: findValueInKvArray('region', authObj.awsv4),
                service: findValueInKvArray('service', authObj.awsv4),
            };
        case 'hawk':
            return {
                type: 'hawk',
                disabled: findValueInKvArray('disabled', authObj.hawk) === 'true',
                algorithm: findValueInKvArray('algorithm', authObj.hawk) === 'sha256' ? 'sha256' : 'sha1',
                id: findValueInKvArray('authId', authObj.hawk),
                key: findValueInKvArray('authKey', authObj.hawk),
                ext: findValueInKvArray('extraData', authObj.hawk),
                validatePayload: findValueInKvArray('validatePayload', authObj.hawk) === 'true',
                // TODO(george): some keys are lost here, see if we can support them in Insomnia
                // timestamp
                // delegation
                // app
                // nonce
                // user
            };
        case 'asap':
            return {
                type: 'asap',
                disabled: findValueInKvArray('disabled', authObj.asap) === 'true',
                issuer: findValueInKvArray('iss', authObj.asap),
                subject: findValueInKvArray('sub', authObj.asap),
                audience: findValueInKvArray('aud', authObj.asap),
                additionalClaims: findValueInKvArray('claims', authObj.asap),
                keyId: findValueInKvArray('kid', authObj.asap),
                privateKey: findValueInKvArray('privateKey', authObj.asap),
            };
        case 'netrc':
            // TODO(george): support this in the script side
            throw Error('netrc is not supported yet');
        default:
            throw Error(`unknown auth type: ${authObj.type}`);
    }
}

export function toPreRequestAuth(auth: RequestAuthentication | {}): AuthOptions {
    if (!auth || !('type' in auth) || !auth.type) {
        return { type: 'noauth' };
    }

    switch (auth.type) {
        case 'none':
            return { type: 'noauth' };
        case 'apikey':
            return {
                type: 'apikey',
                apikey: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'key', value: auth.key || '' },
                    { key: 'value', value: auth.value || '' },
                    { key: 'in', value: auth.addTo || '' },
                ],
            };
        case 'bearer':
            return {
                type: 'bearer',
                bearer: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'token', value: auth.token || '' },
                    { key: 'prefix', value: auth.prefix || '' },
                ],
            };
        case 'basic':
            return {
                type: 'basic',
                basic: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'useISO88591', value: auth.useISO88591 ? 'true' : 'false' },
                    { key: 'username', value: auth.username || '' },
                    { key: 'password', value: auth.password || '' },
                ],
            };
        case 'digest':
            return {
                type: 'digest',
                digest: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'username', value: auth.username || '' },
                    { key: 'password', value: auth.password || '' },
                ],
            };
        case 'ntlm':
            return {
                type: 'ntlm',
                ntlm: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'username', value: auth.username || '' },
                    { key: 'password', value: auth.password || '' },
                ],
            };
        case 'oauth1':
            return {
                type: 'oauth1',
                oauth1: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'signatureMethod', value: auth.signatureMethod || '' },
                    { key: 'consumerKey', value: auth.consumerKey || '' },
                    { key: 'consumerSecret', value: auth.consumerSecret || '' },
                    { key: 'token', value: auth.tokenKey || '' },

                    { key: 'tokenSecret', value: auth.tokenSecret || '' },
                    { key: 'privateKey', value: auth.privateKey || '' },
                    { key: 'version', value: auth.version || '' },
                    { key: 'nonce', value: auth.nonce || '' },
                    { key: 'timestamp', value: auth.timestamp || '' },

                    { key: 'callback', value: auth.callback || '' },
                    { key: 'realm', value: auth.realm || '' },
                    { key: 'verifier', value: auth.verifier || '' },
                    { key: 'includeBodyHash', value: auth.includeBodyHash ? 'true' : 'false' },
                ],
            };
        case 'oauth2':
            const inputGrantType = auth.grantType;
            const grantType = (() => {
                switch (inputGrantType) {
                    case 'authorization_code':
                        return auth.usePkce ? 'authorization_code_with_pkce' : 'authorization_code';
                    case 'implicit':
                        return 'implicit';
                    case 'password':
                        return 'password_credentials';
                    case 'client_credentials':
                        return 'client_credentials';
                    case 'refresh_token':
                        return 'refresh_token';
                    default:
                        throw Error(`auth transforming(toPreRequestAuth): unknown auth grant type for oauth2: ${inputGrantType}`);
                }
            })();

            return {
                type: 'oauth2',
                oauth2: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },

                    { key: 'grant_type', value: grantType },
                    { key: 'authUrl', value: auth.authorizationUrl || '' },
                    { key: 'accessTokenUrl', value: auth.accessTokenUrl || '' },
                    { key: 'clientId', value: auth.clientId || '' },
                    { key: 'clientSecret', value: auth.clientSecret || '' },
                    { key: 'scope', value: auth.scope || '' },

                    { key: 'code_verifier', value: auth.code || '' },
                    { key: 'accessToken', value: auth.accessToken || '' },
                    { key: 'challengeAlgorithm', value: auth.pkceMethod || '' },
                    // { key: 'scope', value: auth.usePkce || ''},
                    { key: 'username', value: auth.username || '' },
                    { key: 'password', value: auth.password || '' },

                    { key: 'callBackUrl', value: auth.redirectUrl || '' },
                    { key: 'state', value: auth.state || '' },
                    { key: 'refreshTokenUrl', value: auth.refreshToken || '' },
                    { key: 'client_authentication', value: auth.credentialsInBody ? 'body' : 'header' },

                    {
                        key: 'tokenRequestParams', value: [
                            {
                                key: 'audience',
                                value: auth.audience || '',
                                enabled: true,
                                send_as: 'request_url', // request_body or request_header

                            },
                            {
                                key: 'resource',
                                value: auth.resource || '',
                                enabled: true,
                                send_as: 'request_url', // request_body or request_header

                            },
                        ],
                    },

                    // following properties are not supported in script side, still set them
                    { key: 'tokenPrefix', value: auth.tokenPrefix || '' },
                    { key: 'response_type', value: auth.responseType || '' },
                    { key: 'origin', value: auth.origin || '' },
                ],
            };
        case 'iam':
            return {
                type: 'awsv4',
                awsv4: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'accessKey', value: auth.accessKeyId || '' },
                    { key: 'secretKey', value: auth.secretAccessKey || '' },
                    { key: 'sessionToken', value: auth.sessionToken || '' },
                    { key: 'region', value: auth.region || '' },
                    { key: 'service', value: auth.service || '' },
                ],
            };
        case 'hawk':
            return {
                type: 'hawk',
                hawk: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'algorithm', value: auth.algorithm || '' },
                    { key: 'authId', value: auth.id || '' },
                    { key: 'authKey', value: auth.key || '' },
                    { key: 'extraData', value: auth.ext || '' },
                    { key: 'validatePayload', value: auth.validatePayload ? 'true' : 'false' },
                    // TODO(george): these fields are not supported in Insomnia side
                    { key: 'timestamp', value: '' },
                    { key: 'delegation', value: '' },
                    { key: 'app', value: '' },
                    { key: 'nonce', value: '' },
                    { key: 'user', value: '' },
                    { key: 'includePayloadHash', value: 'false' },
                ],
            };
        case 'asap':
            return {
                type: 'asap',
                asap: [
                    { key: 'disabled', value: auth.disabled ? 'true' : 'false' },
                    { key: 'iss', value: auth.issuer || '' },
                    { key: 'sub', value: auth.subject || '' },
                    { key: 'aud', value: auth.audience || '' },
                    { key: 'claims', value: auth.additionalClaims || '' },
                    { key: 'kid', value: auth.keyId || '' },
                    { key: 'privateKey', value: auth.privateKey || '' },
                ],
            };
        case 'netrc':
            // TODO: not supported yet
            throw Error('netrc auth is not supported in scripting yet');
        default:
            // @ts-expect-error - user can input any string
            throw Error(`unknown auth type: ${auth.type}`);
    }
}
