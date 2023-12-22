import { getIntepolator } from './intepolator';

export type EventName = 'prerequest' | 'test';

class RequestInfo {
    public eventName: EventName;
    public iteration: number;
    public iterationCount: number;
    public requestName: string;
    public requestId: string;

    constructor(input: {
        eventName?: EventName;
        iteration?: number;
        iterationCount?: number;
        requestName?: string;
        requestId?: string;
    }) {
        this.eventName = input.eventName || 'prerequest';
        this.iteration = input.iteration || 1;
        this.iterationCount = input.iterationCount || 1;
        this.requestName = input.requestName || '';
        this.requestId = input.requestId || '';
    }

    toObject = () => {
        return Object.fromEntries([
            ['eventName', this.eventName],
            ['iteration', this.iteration],
            ['iterationCount', this.iterationCount],
            ['requestName', this.requestName],
            ['requestId', this.requestId],
        ]);
    };
}

class BaseKV {
    private kvs = new Map<string, boolean | number | string>();

    constructor(jsonObject: object | undefined) {
        // TODO: currently it doesn't support getting nested field directly
        this.kvs = new Map(Object.entries(jsonObject || {}));
    }

    has = (variableName: string) => {
        return this.kvs.has(variableName);
    };

    get = (variableName: string) => {
        return this.kvs.get(variableName);
    };

    set = (variableName: string, variableValue: boolean | number | string) => {
        this.kvs.set(variableName, variableValue);
    };

    unset = (variableName: string) => {
        this.kvs.delete(variableName);
    };

    clear = () => {
        this.kvs.clear();
    };

    replaceIn = (template: string) => {
        return getIntepolator().render(template, this.toObject());
    };

    toObject = () => {
        return Object.fromEntries(this.kvs.entries());
    };
}

class Environment extends BaseKV {
    constructor(jsonObject: object | undefined) {
        super(jsonObject);
    }
}

class Variables {
    // TODO: support vars for all levels
    private globals: Environment;
    private collection: Environment;
    private environment: Environment;
    private data: Environment;
    private local: Environment;

    constructor(
        args: {
            globals: Environment;
            collection: Environment;
            environment: Environment;
            data: Environment;
            local: Environment;
        },
    ) {
        this.globals = args.globals;
        this.collection = args.collection;
        this.environment = args.environment;
        this.data = args.data;
        this.local = args.local;
    }

    has = (variableName: string) => {
        const globalsHas = this.globals.has(variableName);
        const collectionHas = this.collection.has(variableName);
        const environmentHas = this.environment.has(variableName);
        const dataHas = this.data.has(variableName);
        const localHas = this.local.has(variableName);

        return globalsHas || collectionHas || environmentHas || dataHas || localHas;
    };

    get = (variableName: string) => {
        let finalVal: boolean | number | string | object | undefined = undefined;
        [
            this.local,
            this.data,
            this.environment,
            this.collection,
            this.globals,
        ].forEach(vars => {
            const value = vars.get(variableName);
            if (!finalVal && value) {
                finalVal = value;
            }
        });

        return finalVal;
    };

    set = (variableName: string, variableValue: boolean | number | string) => {
        this.local.set(variableName, variableValue);
    };

    replaceIn = (template: string) => {
        const context = this.toObject();
        return getIntepolator().render(template, context);
    };

    toObject = () => {
        return [
            this.globals,
            this.collection,
            this.environment,
            this.data,
            this.local,
        ].map(
            vars => vars.toObject()
        ).reduce(
            (ctx, obj) => ({ ...ctx, ...obj }),
            {},
        );
    };
}

class InsomniaObject {
    public globals: Environment;
    public collectionVariables: Environment;
    public environment: Environment;
    public iterationData: Environment;
    public variables: Variables;
    public info: RequestInfo;

    constructor(input: {
        globals: Environment;
        collectionVariables: Environment;
        environment: Environment;
        iterationData: Environment;
        variables: Variables;
        requestInfo: RequestInfo;
    }) {
        this.globals = input.globals;
        this.collectionVariables = input.collectionVariables;
        this.environment = input.environment;
        this.iterationData = input.iterationData;
        this.variables = input.variables;
        this.info = input.requestInfo;
    }

    toObject = () => {
        return {
            globals: this.globals.toObject(),
            variables: this.variables.toObject(),
            environment: this.environment.toObject(),
            collectionVariables: this.collectionVariables.toObject(),
            iterationData: this.iterationData.toObject(),
            info: this.info.toObject(),
        };
    };
}

interface RawObject {
    globals?: object;
    environment?: object;
    collectionVariables?: object;
    iterationData?: object;
    requestInfo?: object;
}

export function initGlobalObject(rawObj: RawObject) {
    const globals = new Environment(rawObj.globals);
    const environment = new Environment(rawObj.environment);
    const collectionVariables = new Environment(rawObj.collectionVariables);
    const iterationData = new Environment(rawObj.iterationData);
    const local = new Environment({});
    const requestInfo = new RequestInfo(rawObj.requestInfo || {});

    const variables = new Variables({
        globals,
        environment,
        collection: collectionVariables,
        data: iterationData,
        local,
    });

    return new InsomniaObject({
        globals,
        environment,
        collectionVariables,
        iterationData,
        variables,
        requestInfo,
    });
};
