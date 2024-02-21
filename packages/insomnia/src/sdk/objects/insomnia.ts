import type { Request } from '../../models/request';
import { Environment } from './environments';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
}

export class InsomniaObject {
    public environment: Environment;

    constructor(
        rawObj: {
            environment: Environment;
        },
    ) {
        this.environment = rawObj.environment;
    }

    toObject = () => {
        return {
            environment: this.environment.toObject(),
        };
    };
}

export function initInsomniaObject(
    rawObj: RequestContext,
) {
    const environment = new Environment(rawObj.environment);

    return new InsomniaObject(
        {
            environment,
        },
    );
};
