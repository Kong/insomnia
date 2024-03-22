import { getIntepolator } from './interpolator';
export class Environment {
    private kvs = new Map<string, boolean | number | string>();

    constructor(jsonObject: object | undefined) {
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

export class Variables {
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
        },
    ) {
        this.globals = args.globals;
        this.collection = args.collection;
        this.environment = args.environment;
        this.data = args.data;
        this.local = new Environment({});
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
