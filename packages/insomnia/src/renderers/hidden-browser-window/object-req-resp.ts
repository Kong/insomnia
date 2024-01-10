import queryString from 'query-string';

import { AuthOptions } from './object-auth';
import { Property, PropertyBase, PropertyList } from './object-base';
import { CertificateOptions } from './object-certificates';
import { HeaderOptions } from './object-headers';
import { ProxyConfigOptions } from './object-proxy-configs';
import { Url } from './object-urls';

// export type RequestBodyMode =
// file	string
// formdata	string
// graphql	string
// raw	string
// urlencoded	string

export type RequestBodyMode = undefined | 'formdata' | 'urlencoded' | 'raw' | 'file' | 'graphql';

export interface RequestBodyOptions {
    mode: RequestBodyMode;
    file?: string;
    formdata?: { key: string; value: string }[];
    graphql?: object;
    raw?: string;
    urlencoded?: { key: string; value: string }[] | string;
}

class FormParam {
    key: string;
    value: string;

    constructor(options: { key: string; value: string }) {
        this.key = options.key;
        this.value = options.value;
    }

    // (static) _postman_propertyAllowsMultipleValues :Boolean
    // (static) _postman_propertyIndexKey :String

    // not implemented either
    // static parse(_: FormParam) {
    //     throw Error('unimplemented yet');
    // }

    toJSON() {
        return { key: this.key, value: this.value };
    }

    toString() {
        return `${this.key}=${this.value}`; // validate key, value contains '='
    }

    valueOf() {
        return this.value;
    }
}

class QueryParam extends Property {
    key: string;
    value: string;

    constructor(options: { key: string; value: string } | string) {
        super();

        if (typeof options === 'string') {
            try {
                const optionsObj = JSON.parse(options);
                // validate key and value fields
                this.key = optionsObj.key;
                this.value = optionsObj.value;
            } catch (e) {
                throw Error(`invalid QueryParam options ${e}`);
            }
        } else if (typeof options === 'object' && ('key' in options) && ('value' in options)) {
            this.key = options.key;
            this.value = options.value;
        } else {
            throw Error('unknown options for new QueryParam');
        }
    }

    // TODO:
    // (static) _postman_propertyAllowsMultipleValues :Boolean
    // (static) _postman_propertyIndexKey :String

    static parse(queryStr: string) {
        // this may not always be executed in the browser
        return queryString.parse(queryStr);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static parseSingle(param: string, _idx?: number, _all?: string[]) {
        // it seems that _idx and _all are not useful
        return queryString.parse(param);

    }

    static unparse(params: object) {
        return Object.entries(params)
            .map(entry => `${entry[0]}=${entry[1] || ''}`)
            .join('&');
    }

    static unparseSingle(obj: { key: string; value: string }) {
        if ('key' in obj && 'value' in obj) {
            // TODO: validate and unescape
            return `${obj.key}=${obj.value}`;
        }
        return {};
    }

    toString() {
        return `${this.key}=${this.value}`; // validate key, value contains '='
    }

    update(param: string | { key: string; value: string }) {
        if (typeof param === 'string') {
            const paramObj = QueryParam.parse(param);
            this.key = typeof paramObj.key === 'string' ? paramObj.key : '';
            this.value = typeof paramObj.value === 'string' ? paramObj.value : '';
        } else if ('key' in param && 'value' in param) {
            this.key = param.key;
            this.value = param.value;
        } else {
            throw Error('the param for update must be: string | { key: string; value: string }');
        }
    }
}

export class RequestBody extends PropertyBase {
    mode: RequestBodyMode; // type of request data
    file?: string;  // It can be a file path (when used with Node.js) or a unique ID (when used with the browser).
    formdata?: PropertyList<FormParam>;
    graphql?: object; // raw graphql data
    options?: object; // request body options
    raw?: string; // raw body
    urlencoded?: PropertyList<QueryParam> | string; // URL encoded body params

    constructor(opts: RequestBodyOptions) {
        super({ description: '' });

        this.file = opts.file;
        this.formdata = opts.formdata ?
            new PropertyList(
                opts.formdata.
                    map(formParamObj => new FormParam({ key: formParamObj.key, value: formParamObj.value }))
            ) :
            undefined;
        this.graphql = opts.graphql;
        this.mode = opts.mode;
        // this.options = opts.options;
        this.raw = opts.raw;

        if (typeof opts.urlencoded === 'string') {
            const queryParamObj = QueryParam.parse(opts.urlencoded);
            this.urlencoded = opts.urlencoded ?
                new PropertyList(
                    Object.entries(queryParamObj)
                        .map(entry => ({ key: entry[0], value: JSON.stringify(entry[1]) }))
                        .map(kv => new QueryParam(kv)),
                ) :
                undefined;
        } else {
            // TODO: validate key, value in each entry
            this.urlencoded = opts.urlencoded ?
                new PropertyList(
                    opts.urlencoded
                        .map(entry => ({ key: entry.key, value: entry.value }))
                        .map(kv => new QueryParam(kv)),
                ) :
                undefined;
        }
    }

    isEmpty() {
        switch (this.mode) {
            case 'formdata':
                return this.formdata == null;
            case 'urlencoded':
                return this.urlencoded == null;
            case 'raw':
                return this.raw == null;
            case 'file':
                return this.file == null;
            case 'graphql':
                return this.graphql == null;
            default:
                throw Error(`mode (${this.mode}) is unexpected`);
        }
    }

    toString() {
        try {
            switch (this.mode) {
                case 'formdata':
                    return this.formdata ? this.formdata?.toString() : '';
                case 'urlencoded':
                    return this.urlencoded ? this.urlencoded.toString() : '';
                case 'raw':
                    return this.raw ? this.raw.toString() : '';
                case 'file':
                    return this.file || ''; // TODO: check file id or file content
                case 'graphql':
                    return this.graphql ? JSON.stringify(this.graphql) : '';
                default:
                    throw Error(`mode (${this.mode}) is unexpected`);
            }
        } catch (e) {
            return '';
        }
    }

    update(opts: RequestBodyOptions) {
        this.file = opts.file;
        this.formdata = opts.formdata ?
            new PropertyList(
                opts.formdata.
                    map(formParamObj => new FormParam({ key: formParamObj.key, value: formParamObj.value }))
            ) :
            undefined;
        this.graphql = opts.graphql;
        this.mode = opts.mode;
        // this.options = opts.options;
        this.raw = opts.raw;

        if (typeof opts.urlencoded === 'string') {
            const queryParamObj = QueryParam.parse(opts.urlencoded);
            this.urlencoded = opts.urlencoded ?
                new PropertyList(
                    Object.entries(queryParamObj)
                        .map(entry => ({ key: entry[0], value: JSON.stringify(entry[1]) }))
                        .map(kv => new QueryParam(kv)),
                ) :
                undefined;
        } else {
            // TODO: validate key, value in each entry
            this.urlencoded = opts.urlencoded ?
                new PropertyList(
                    opts.urlencoded
                        .map(entry => ({ key: entry.key, value: JSON.stringify(entry.value) }))
                        .map(kv => new QueryParam(kv)),
                ) :
                undefined;
        }
    }
}

export interface RequestOptions {
    url: string | Url;
    method: string;
    header: HeaderOptions;
    body: RequestBodyOptions;
    auth: AuthOptions;
    proxy: ProxyConfigOptions;
    certificate: CertificateOptions;
}

export class Request extends Property {

}
