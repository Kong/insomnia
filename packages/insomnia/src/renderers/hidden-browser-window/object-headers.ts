import { Property, PropertyList } from './object-base';

export interface HeaderOptions {
    id?: string;
    name?: string;
    type?: string;
    disabled?: boolean;
    key: string;
    value: string;
}

export class Header extends Property {
    kind: string = 'Header';
    type: string = '';
    key: string;
    value: string;

    constructor(
        opts: HeaderOptions | string,
        name?: string, // if it is defined, it overrides 'key' (not 'name')
    ) {
        super();

        if (typeof opts === 'string') {
            const obj = Header.parseSingle(opts);
            this.key = obj.key;
            this.value = obj.value;
        } else {
            this.id = opts.id ? opts.id : '';
            this.key = opts.key ? opts.key : '';
            this.name = name ? name : (opts.name ? opts.name : '');
            this.value = opts.value ? opts.value : '';
            this.type = opts.type ? opts.type : '';
            this.disabled = opts ? opts.disabled : false;
        }
    }

    static create(input?: { key: string; value: string } | string, name?: string): Header {
        return new Header(input || { key: '', value: '' }, name);
    }

    static isHeader(obj: object) {
        return 'kind' in obj && obj.kind === 'Header';
    }

    // example: 'Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0\n'
    static parse(headerString: string): { key: string; value: string }[] {
        return headerString
            .split('\n')
            .map(kvPart => Header.parseSingle(kvPart));
    }

    static parseSingle(headerStr: string): { key: string; value: string } {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
        // the first colon is the separator
        const separatorPos = headerStr.indexOf(':');
        const key = headerStr.slice(0, separatorPos);
        const value = headerStr.slice(separatorPos + 1);

        return { key, value };
    }

    static unparse(headers: { key: string; value: string }[] | PropertyList<Header>, separator?: string): string {
        const headerStrs = headers.map(
            header => this.unparseSingle(header), {}
        );

        return headerStrs.join(separator || '\n');
    }

    static unparseSingle(header: { key: string; value: string } | Header): string {
        // both PropertyList and object contains 'key' and 'value'
        return `${header.key}: ${header.value}`;
    }

    update(newHeader: { key: string; value: string }) {
        this.key = newHeader.key;
        this.value = newHeader.value;
    }

    valueOf() {
        return this.value;
    }
}

export class HeaderList<T extends Header> extends PropertyList<T> {
    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(populate);
        this._parent = parent;
    }

    static isHeaderList(obj: any) {
        return 'kind' in obj && obj.kind === 'HeaderList';
    }

    // unsupported
    // eachParent(iterator, contextopt)
    // toObject(excludeDisabledopt, nullable, caseSensitiveopt, nullable, multiValueopt, nullable, sanitizeKeysopt) → {Object}

    contentSize(): number {
        return this.list
            .map(header => header.toString())
            .map(headerStr => headerStr.length) // TODO: handle special characters
            .reduce((totalSize, headerSize) => totalSize + headerSize, 0);
    }
}
