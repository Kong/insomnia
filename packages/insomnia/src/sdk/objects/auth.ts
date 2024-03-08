import {
    AUTH_API_KEY,
    AUTH_ASAP,
    AUTH_AWS_IAM,
    AUTH_BASIC,
    AUTH_BEARER,
    AUTH_DIGEST,
    AUTH_HAWK,
    AUTH_NETRC,
    AUTH_NONE,
    AUTH_NTLM,
    AUTH_OAUTH_1,
    AUTH_OAUTH_2,
    HAWK_ALGORITHM_SHA256,
} from '../../common/constants';
import { Property } from './properties';
import { Variable, VariableList } from './variables';

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
]);

export interface AuthOption {
    key: string;
    value: string;
    type?: string;
}

export interface BasicOptions {
    password: string;
    username: string;
    id: string;
}

export interface BearerOptions {
    token: string;
    id: string;
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
    id: string;
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
    id: string;
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
    id: string;
}

export interface OAuth2Param {
    key: string;
    value: string;
    enabled: boolean;
    send_as: string; // it follows exising naming
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
    tokenName: string;
    addTokenTo: string;
    id: string;
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
    id: string;
}

export interface AWSV4Options {
    sessionToken: string;
    service: string;
    region: string;
    secretKey: string;
    accessKey: string;
    id: string;
}

export interface NTLMOptions {
    workstation: string;
    domain: string;
    password: string;
    username: string;
    id: string;
}

export interface APIKeyOptions {
    key: string;
    value: string;
    id: string;
}

export interface EdgegridOptions {
    headersToSign: string;
    baseURL: string;
    timestamp: string;
    nonce: string;
    clientSecret: string;
    clientToken: string;
    accessToken: string;
    id: string;
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
    id: string;
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
    type: string;
    basic?: AuthOption[];
    bearer?: AuthOption[];
    jwt?: AuthOption[];
    digest?: AuthOption[];
    oauth1?: AuthOption[];
    oauth2?: AuthOption[];
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
    private type: string;
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

    toJSON() {
        const obj: AuthOptions = { type: this.type };
        const authOption = this.authOptions.get(this.type);
        if (!authOption) {
            return obj;
        }

        const authOptionJSON = authOption.map(optValue => optValue.toJSON(), {});

        switch (this.type) {
            case 'basic':
                obj.basic = authOptionJSON;
                break;
            case 'bearer':
                obj.bearer = authOptionJSON;
                break;
            case 'jwt':
                obj.jwt = authOptionJSON;
                break;
            case 'digest':
                obj.digest = authOptionJSON;
                break;
            case 'oauth1':
                obj.oauth1 = authOptionJSON;
                break;
            case 'oauth2':
                obj.oauth2 = authOptionJSON;
                break;
            case 'hawk':
                obj.hawk = authOptionJSON;
                break;
            case 'awsv4':
                obj.awsv4 = authOptionJSON;
                break;
            case 'ntlm':
                obj.ntlm = authOptionJSON;
                break;
            case 'apikey':
                obj.apikey = authOptionJSON;
                break;
            case 'edgegrid':
                obj.edgegrid = authOptionJSON;
                break;
            case 'asap':
                obj.asap = authOptionJSON;
                break;
            default: // noauth, no op
        }

        return obj;
    }

    update(options: VariableList<Variable> | Variable[] | AuthOptions, type?: string) {
        const currentType = type ? type : this.type;
        const authOpts = rawOptionsToVariables(options, currentType);

        if (authOpts.length > 0) {
            this.authOptions.set(currentType, authOpts[0]);
        } else {
            throw Error('no valid RequestAuth options is found');
        }
    }

    use(type: string, options: VariableList<Variable> | Variable[] | AuthOptions) {
        if (!RequestAuth.isValidType(type)) {
            throw Error(`invalid type (${type}), it must be noauth | basic | bearer | jwt | digest | oauth1 | oauth2 | hawk | awsv4 | ntlm | apikey | edgegrid | asap.`);
        }

        const authOpts = rawOptionsToVariables(options, type);
        if (authOpts.length > 0) {
            this.type = type;
            this.authOptions.set(type, authOpts[0]);
        } else {
            throw Error('no valid RequestAuth options is found');
        }
    }
}

export function toPreRequestAuth(auth: Record<string, any>) {
    if (!auth || !auth.type) {
        return { type: 'noauth' };
    }

    switch (auth.type) {
        case AUTH_NONE:
            return { type: 'noauth' };
        case AUTH_API_KEY:
            return {
                type: 'apikey',
                apikey: [
                    { key: 'key', value: auth.key },
                    { key: 'value', value: auth.value },
                    { key: 'in', value: auth.in || 'header' },
                ],
            };
        case AUTH_BEARER:
            return {
                type: 'bearer',
                bearer: [
                    { key: 'token', value: auth.token },
                ],
            };
        case AUTH_BASIC:
            return {
                type: 'basic',
                basic: [
                    { key: 'useISO88591', value: auth.useISO88591 },
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case AUTH_DIGEST:
            return {
                type: 'digest',
                digest: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case AUTH_NTLM:
            return {
                type: 'ntlm',
                ntlm: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case AUTH_OAUTH_1:
            return {
                type: 'oauth1',
                oauth1: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'consumerKey', value: auth.consumerKey },
                    { key: 'consumerSecret', value: auth.consumerSecret },
                    { key: 'tokenKey', value: auth.tokenKey },
                    { key: 'tokenSecret', value: auth.tokenSecret },
                    { key: 'privateKey', value: auth.privateKey },
                    { key: 'version', value: auth.version },
                    { key: 'nonce', value: auth.nonce },
                    { key: 'timestamp', value: auth.timestamp },
                    { key: 'callback', value: auth.callback },
                ],
            };
        case AUTH_OAUTH_2:
            return {
                type: 'oauth2',
                oauth2: [
                    { key: 'key', value: auth.key },
                    { key: 'value', value: auth.value },
                    { key: 'enabled', value: auth.enabled },
                    { key: 'send_as', value: auth.send_as },
                ],
            };
        case AUTH_AWS_IAM:
            return {
                type: 'awsv4',
                awsv4: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'accessKeyId', value: auth.accessKeyId },
                    { key: 'secretAccessKey', value: auth.secretAccessKey },
                    { key: 'sessionToken', value: auth.sessionToken },
                ],
            };
        case AUTH_HAWK:
            // TODO: actually it is not supported
            return {
                type: 'hawk',
                hawk: [
                    { key: 'includePayloadHash', value: auth.includePayloadHash },
                    { key: 'timestamp', value: auth.timestamp },
                    { key: 'delegation', value: auth.delegation },
                    { key: 'app', value: auth.app },
                    { key: 'extraData', value: auth.extraData },
                    { key: 'nonce', value: auth.nonce },
                    { key: 'user', value: auth.user },
                    { key: 'authKey', value: auth.authKey },
                    { key: 'authId', value: auth.authId },
                    { key: 'algorithm', value: auth.algorithm },
                    { key: 'id', value: auth.id },
                ],
            };
        case AUTH_ASAP:
            return {
                type: 'asap',
                asap: [
                    { key: 'exp', value: auth.exp },
                    { key: 'claims', value: auth.claims },
                    { key: 'sub', value: auth.sub },
                    { key: 'privateKey', value: auth.privateKey },
                    { key: 'kid', value: auth.kid },
                    { key: 'aud', value: auth.aud },
                    { key: 'iss', value: auth.iss },
                    { key: 'alg', value: auth.alg },
                    { key: 'id', value: auth.id },
                ],
            };
        case AUTH_NETRC:
            // TODO: not supported yet
            throw Error('net rc is not supported yet');
        default:
            throw Error(`unknown auth type: ${auth.type}`);
    }
}

export function fromPreRequestAuth(auth: RequestAuth) {
    const authObj = auth.toJSON();
    const findValueInObj = (targetKey: string, kvs?: { key: string; value: string }[]) => {
        if (!kvs) {
            return '';
        }

        return kvs.find(
            (kv: { key: string; value: string }) => {
                return kv.key === targetKey ? kv.value : '';
            },
            '',
        );
    };

    switch (authObj.type) {
        case 'noauth':
            return {};
        // TODO: these 2 methods are not supported yet
        case 'apikey':
            return {
                disabled: false,
                type: AUTH_API_KEY,
                key: findValueInObj('key', authObj.apikey),
                value: findValueInObj('value', authObj.apikey),
                in: findValueInObj('in', authObj.apikey),
            };
        case 'bearer':
            return {
                type: AUTH_BEARER,
                disabled: false,
                token: findValueInObj('token', authObj.bearer),
            };
        case 'basic':
            return {
                type: AUTH_BASIC,
                useISO88591: false,
                disabled: false,
                username: findValueInObj('username', authObj.basic),
                password: findValueInObj('password', authObj.basic),
            };
        case 'digest':
            return {
                type: AUTH_DIGEST,
                disabled: false,
                username: findValueInObj('username', authObj.digest),
                password: findValueInObj('password', authObj.digest),
            };
        case 'ntlm':
            return {
                type: AUTH_NTLM,
                disabled: false,
                username: findValueInObj('username', authObj.ntlm),
                password: findValueInObj('password', authObj.ntlm),
            };
        case 'oauth1':
            return {
                type: AUTH_OAUTH_1,
                disabled: false,
                signatureMethod: 'HMAC-SHA1',
                consumerKey: findValueInObj('consumerKey', authObj.oauth1),
                consumerSecret: findValueInObj('consumerSecret', authObj.oauth1),
                tokenKey: findValueInObj('token', authObj.oauth1),
                tokenSecret: findValueInObj('tokenSecret', authObj.oauth1),
                privateKey: findValueInObj('verifier', authObj.oauth1),
                version: '1.0',
                nonce: findValueInObj('nonce', authObj.oauth1),
                timestamp: findValueInObj('timestamp', authObj.oauth1),
                callback: findValueInObj('callback', authObj.oauth1),
            };
        case AUTH_OAUTH_2:
            return {
                type: AUTH_OAUTH_2,
                grantType: 'authorization_code',
            };
        case 'awsv4':
            return {
                type: AUTH_AWS_IAM,
                disabled: false,
                accessKeyId: findValueInObj('accessKey', authObj.awsv4),
                secretAccessKey: findValueInObj('secretKey', authObj.awsv4),
                sessionToken: findValueInObj('sessionToken', authObj.awsv4),
            };
        case 'hawk':
            return {
                type: AUTH_HAWK,
                algorithm: HAWK_ALGORITHM_SHA256,
            };
        case 'asap':
            return {
                type: AUTH_ASAP,
                issuer: findValueInObj('iss', authObj.asap),
                subject: findValueInObj('sub', authObj.asap),
                audience: findValueInObj('aud', authObj.asap),
                additionalClaims: findValueInObj('claims', authObj.asap),
                keyId: findValueInObj('kid', authObj.asap),
                verifier: findValueInObj('privateKey', authObj.asap),
            };
        case 'netrc':
            throw Error('netrc auth is not supported yet');
        default:
            throw Error(`unknown auth type: ${authObj.type}`);
    }
}
