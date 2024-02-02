import { Property, PropertyList } from './base';

export interface VariableOptions {
    id?: string;
    key: string;
    name?: string;
    value: string;
    type?: string;
    disabled?: boolean;
}

export class Variable extends Property {
    key: string;
    value: any;
    type: string;
    _kind: string = 'Variable';

    constructor(def?: VariableOptions) {
        super();

        this.id = def ? def.id || '' : '';
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
        if ('_kind' in value && value._kind === 'Variable') {
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
    _kind: string = 'VariableList';

    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(populate);
        this._parent = parent;
    }

    static isVariableList(obj: any) {
        return '_kind' in obj && obj._kind === 'VariableList';
    }
}
