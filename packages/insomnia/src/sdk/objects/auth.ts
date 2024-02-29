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
