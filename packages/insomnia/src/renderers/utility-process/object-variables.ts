import { Property, PropertyList } from './object-base';

export class Variable extends Property {
    key: string;
    value: any;
    type: string;
    kind: string = 'Variable';

    constructor(def?: {
        id?: string;
        key: string;
        name?: string;
        value: string;
        type?: string;
        disabled?: boolean;
    }) {
        super();

        this.id = def ? def.id : '';
        this.key = def ? def.key : '';
        this.name = def ? def.name : '';
        this.value = def ? def.value : '';
        this.type = def && def.type ? def.type : 'Variable';
        this.disabled = def ? def.disabled : false;
    }

    // unknown usage and unsupported
    // static readonly types() => {
    // }

    // cast typecasts a value to the Variable.types of this Variable.
    cast(value: any) {
        if ('kind' in value && value.kind === 'Variable') {
            return value.value;
        }
        return undefined;
    }

    get() {
        return this.value;
    }

    set(value: any) {
        this.value = value;
    }
}

export class VariableList<T extends Variable> extends PropertyList<T> {
    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(populate);
        this._parent = parent;
    }

    static isVariableList(obj: any) {
        return 'kind' in obj && obj.kind === 'VariableList';
    }
}
