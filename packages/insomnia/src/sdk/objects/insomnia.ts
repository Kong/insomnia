import type { Request } from '../../models/request';
import { Environment, Variables } from './environments';

export const unsupportedError = (featureName: string, alternative?: string) => {
    const message = `${featureName} is not supported yet` +
        (alternative ? `, please use ${alternative} instead temporarily.` : '');
    return Error(message);
};

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    baseEnvironment?: object;
    collectionVariables?: object;
    globals?: object;
    iterationData?: object;
}

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;
    public variables: Variables;

    // TODO: follows will be enabled after Insomnia supports them
    private _globals: Environment;
    private _iterationData: Environment;

    constructor(
        rawObj: {
            globals: Environment;
            iterationData: Environment;
            environment: Environment;
            baseEnvironment: Environment;
            variables: Variables;
        },
    ) {
        this._globals = rawObj.globals;
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this._iterationData = rawObj.iterationData;
        this.variables = rawObj.variables;
    }

    // TODO: remove this after enabled globals
    get globals() {
        throw unsupportedError('globals', 'base environment');
    }

    // TODO: remove this after enabled iterationData
    get iterationData() {
        throw unsupportedError('iterationData', 'environment');
    }

    toObject = () => {
        return {
            globals: this._globals.toObject(),
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
            iterationData: this._iterationData.toObject(),
            variables: this.variables.toObject(),
        };
    };
}

export function initInsomniaObject(
    rawObj: RequestContext,
) {
    const globals = new Environment(rawObj.globals);
    const environment = new Environment(rawObj.environment);
    const baseEnvironment = new Environment(rawObj.baseEnvironment);
    const iterationData = new Environment(rawObj.iterationData);
    const collectionVariables = new Environment(rawObj.collectionVariables);

    const variables = new Variables({
        globals,
        environment,
        collection: collectionVariables,
        data: iterationData,
    });

    return new InsomniaObject(
        {
            globals,
            environment,
            baseEnvironment,
            iterationData,
            variables,
        },
    );
};
