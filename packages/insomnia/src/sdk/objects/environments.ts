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

    // TODO: enable this after intepolator is introduced
    // replaceIn = (template: string) => {
    //     return getIntepolator().render(template, this.toObject());
    // };

    toObject = () => {
        return Object.fromEntries(this.kvs.entries());
    };
}
