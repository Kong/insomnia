import type { Request } from '../../models/request';
import { Environment } from './environments';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    baseEnvironment?: object;
}

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;

    constructor(
        rawObj: {
            environment: Environment;
            baseEnvironment: Environment;
        },
    ) {
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
    }

    toObject = () => {
        return {
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
        };
    };
}

export function initInsomniaObject(
    rawObj: RequestContext,
) {
    const environment = new Environment(rawObj.environment);
    const baseEnvironment = new Environment(rawObj.baseEnvironment);

    return new InsomniaObject(
        {
            environment,
            baseEnvironment,
        },
    );
};
