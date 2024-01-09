import { Property } from './object-base';
import { Variable, VariableList } from './object-variables';

const AuthTypes = new Set([
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
    type: string;
    key: string;
    value: string;
}

export interface RawAuthOptions {
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

function rawOptionsToVariables(options: VariableList<Variable> | Variable[] | object, targetType?: string): VariableList<Variable>[] {
    if (VariableList.isVariableList(options)) {
        return [options as VariableList<Variable>];
    } else if ('type' in options) { // object
        const optsObj = options as RawAuthOptions;
        const optsVarLists = Object.entries(optsObj)
            .filter(optsObjEntry => optsObjEntry[0] === targetType)
            .map(optsEntry => {
                return new VariableList(
                    undefined,
                    optsEntry.map(opt => new Variable({
                        key: opt.key,
                        value: opt.value,
                        type: opt.type,
                    })),
                );
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

    constructor(options: RawAuthOptions, parent?: Property) {
        super();

        if (!RequestAuth.isValidType(options.type)) {
            throw Error(`invalid auth type ${options.type}`);
        }
        this.type = options.type;
        const optsObj = options as RawAuthOptions;
        Object.entries(optsObj)
            .filter(optsObjEntry => optsObjEntry[0] !== 'type')
            .map(optsEntry => {
                return {
                    type: optsEntry[0],
                    options: new VariableList(
                        undefined,
                        optsEntry.map(opt => new Variable({
                            key: opt.key,
                            value: opt.value,
                            type: opt.type,
                        })),
                    ),
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

    parameters() {
        return this.authOptions.get(this.type);
    }

    toJSON() {
        const obj: RawAuthOptions = { type: this.type };
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

    update(options: VariableList<Variable> | Variable[] | object, type?: string) {
        const currentType = type ? type : this.type;
        const authOpts = rawOptionsToVariables(options, currentType);
        if (authOpts.length > 0) {
            this.authOptions.set(currentType, authOpts[0]);
        } else {
            throw Error('no valid RequestAuth options is found');
        }
    }

    use(type: string, options: VariableList<Variable> | Variable[] | object) {
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
