import clone from 'clone';
import equal from 'deep-equal';
import _ from 'lodash';

import { unsupportedError } from './insomnia';

export class PropertyBase {
    public _kind = 'PropertyBase';
    protected _parent: PropertyBase | undefined = undefined;
    protected description?: string;

    constructor(description?: string) {
        this.description = description;
    }

    static propertyIsMeta(_value: any, key: string) {
        // no meta is defined in Insomnia and it basically find properties start with '_'
        // '_' is also rejected here
        return key && key.startsWith('_');
    }

    static propertyUnprefixMeta(_value: any, key: string) {
        return _.trimStart(key, '_');
    }

    static toJSON(obj: object) {
        if ('toJSON' in obj && typeof obj.toJSON === 'function') {
            return obj.toJSON();
        } else {
            try {
                return JSON.parse(JSON.stringify(obj));
            } catch (e) {
                throw Error(`failed to call "toJSON" for ${obj}`);
            }
        }
    }

    meta() {
        return {};
    };

    parent() {
        return this._parent;
    }

    forEachParent(
        _options: { withRoot?: boolean },
        iterator: (obj: PropertyBase) => boolean,
    ) {
        const currentParent = this.parent();
        if (!currentParent) {
            return;
        }

        const queue: PropertyBase[] = [currentParent];
        const parents: PropertyBase[] = [];

        while (queue.length > 0) {
            const ancester = queue.shift();
            if (!ancester) {
                continue;
            }

            // TODO: check options
            const cloned = clone(ancester);
            const keepIterating = iterator(cloned);
            parents.push(cloned);
            if (!keepIterating) {
                break;
            }

            const olderAncester = ancester.parent();
            if (olderAncester) {
                queue.push(olderAncester);
            }
        }

        return parents;
    }

    findInParents(
        property: string,
        customizer?: (ancester: PropertyBase) => boolean,
    ): PropertyBase | undefined {
        const currentParent = this.parent();
        if (!currentParent) {
            return;
        }

        const queue: PropertyBase[] = [currentParent];

        while (queue.length > 0) {
            const ancester = queue.shift();
            if (!ancester) {
                continue;
            }

            const cloned = clone(ancester);
            const hasProperty = Object.keys(cloned.meta()).includes(property);
            if (!hasProperty) {
                // keep traversing until parent has the property
                // no op
            } else {
                if (customizer) {
                    if (customizer(cloned)) {
                        // continue until customizer returns a truthy value
                        return cloned;
                    }
                } else {
                    // customizer is not specified
                    // stop at the first parent that contains the property
                    return cloned;
                }
            }

            const olderAncester = ancester.parent();
            if (olderAncester) {
                queue.push(olderAncester);
            }
        }

        return undefined;
    }

    toJSON() {
        const entriesToExport = Object
            .entries(this)
            .filter((kv: [string, any]) =>
                typeof kv[1] !== 'function' && typeof kv[1] !== 'undefined'
            );

        return Object.fromEntries(entriesToExport);
    }

    toObject() {
        return this.toJSON();
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }
}

export class Property extends PropertyBase {
    id: string;
    name?: string;
    disabled?: boolean;
    // TODO: parent property will be introduced when collection manipulation is supported

    constructor(
        id?: string,
        name?: string,
        disabled?: boolean,
        info?: { id?: string; name?: string },
    ) {
        super();
        this._kind = 'Property';
        this.id = info?.id || id || '';
        this.name = info?.name || name || '';
        this.disabled = disabled || false;

    }

    // TODO: unsupported yet
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static replaceSubstitutions(_str: string, _variables: object): string {
        throw unsupportedError('replaceSubstitutions');
    }

    // TODO: unsupported yet
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static replaceSubstitutionsIn(_obj: string, _variables: object): object {
        throw unsupportedError('replaceSubstitutionsIn');
    }

    describe(content: string, typeName: string) {
        this._kind = typeName;
        this.description = content;
    }
}

export class PropertyList<T extends Property> {
    protected _kind: string = 'PropertyList';
    protected list: T[] = [];

    constructor(
        protected readonly _typeClass: {}, // TODO: it is not used before collection is introduced
        protected readonly parent: Property | PropertyList<any> | undefined,
        populate: T[],
    ) {
        this.parent = parent;
        this.list = populate;
    }

    static isPropertyList(obj: object) {
        return '_kind' in obj && obj._kind === 'PropertyList';
    }

    add(item: T) {
        this.list.push(item);
    }

    all() {
        return this.list.map(pp => pp.toJSON());
    }

    append(item: T) {
        this.add(item);
    }

    assimilate(source: T[] | PropertyList<T>, prune?: boolean) {
        // it doesn't update values from a source list
        if (prune) {
            this.clear();
        }
        if ('list' in source) { // it is PropertyList<T>
            this.list.push(...source.list);
        } else {
            this.list.push(...source);
        }
    }

    clear() {
        this.list = [];
    }

    count() {
        return this.list.length;
    }

    each(iterator: (item: T) => void, context: object) {
        interface Iterator {
            context?: object;
            (item: T): void;
        }
        const it: Iterator = iterator;
        it.context = context;

        this.list.forEach(it);
    }

    // TODO: unsupported yet as properties are not organized as hierarchy
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eachParent(_iterator: (parent: Property, prev: Property) => void, _context?: object) {
        throw unsupportedError('eachParent');
    }

    filter(rule: (item: T) => boolean, context: object) {
        interface Iterator {
            context?: object;
            (item: T): boolean;
        }
        const it: Iterator = rule;
        it.context = context;

        return this.list.filter(it);
    }

    // TODO: support returning {Item|ItemGroup}
    find(rule: (item: T) => boolean, context?: object) {
        interface Finder {
            context?: object;
            (item: T): boolean;
        }
        const finder: Finder = rule;
        finder.context = context;

        return this.list.find(finder);
    }

    // it does not return underlying type of the item because they are not supported
    get(key: string) {
        return this.one(key);
    }

    // TODO: value is not used as its usage is unknown
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    has(item: T, _value?: any) {
        return this.indexOf(item) >= 0;
    }

    idx(index: number) {
        if (index <= this.list.length - 1) {
            return this.list[index];
        }
        return undefined;
    }

    indexOf(item: string | T) {
        for (let i = 0; i < this.list.length; i++) {
            if (equal(item, this.list[i])) {
                return i;
            }
        }
        return -1;
    }

    insert(item: T, before?: number) {
        if (before != null && before >= 0 && before <= this.list.length - 1) {
            this.list = [...this.list.slice(0, before), item, ...this.list.slice(before)];
        } else {
            this.append(item);
        }
    }

    insertAfter(item: T, after?: number) {
        if (after != null && after >= 0 && after <= this.list.length - 1) {
            this.list = [...this.list.slice(0, after + 1), item, ...this.list.slice(after + 1)];
        } else {
            this.append(item);
        }
    }

    map(iterator: (item: T) => any, context: object) {
        interface Iterator {
            context?: object;
            (item: T): any;
        }
        const it: Iterator = iterator;
        it.context = context;

        return this.list.map(it);
    }

    one(id: string) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            if (this.list[i].id === id) {
                return this.list[i];
            }
        }

        return undefined;
    }

    populate(items: T[]) {
        this.list = [...this.list, ...items];
    }

    prepend(item: T) {
        this.list = [item, ...this.list];
    }

    reduce(iterator: ((acc: any, item: T) => any), accumulator: any, context: object) {
        interface Iterator {
            context?: object;
            (acc: any, item: T): any;
        }
        const it: Iterator = iterator;
        it.context = context;

        return this.list.reduce(it, accumulator);
    }

    remove(predicate: T | ((item: T) => boolean), context: object) {
        if (typeof predicate === 'function') {
            const reversePredicate = (item: T) => !predicate(item);
            this.list = this.filter(reversePredicate, context);
        } else {
            this.list = this.filter(item => !equal(predicate, item), context);
        }
    }

    repopulate(items: T[]) {
        this.clear();
        this.populate(items);
    }

    // TODO: unsupported yet
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    toObject(_excludeDisabled?: boolean, _caseSensitive?: boolean, _multiValue?: boolean, _sanitizeKeys?: boolean) {
        // unsupported as _postman_propertyIndexKey is not supported
        throw unsupportedError('toObject');
    }

    toString() {
        const itemStrs = this.list.map(item => item.toString());
        return `[${itemStrs.join('; ')}]`;
    }

    upsert(item: T): boolean {
        if (item == null) {
            return false;
        }

        const itemIdx = this.indexOf(item);
        if (itemIdx >= 0) {
            this.list = [...this.list.splice(0, itemIdx), item, ...this.list.splice(itemIdx + 1)];
            return false;
        }

        this.add(item);
        return true;
    }
}
