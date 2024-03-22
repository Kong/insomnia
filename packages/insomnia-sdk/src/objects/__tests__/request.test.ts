import url from 'node:url';

import { describe, expect, it } from '@jest/globals';

import { Request, RequestBody } from '../request';
import { setUrlParser } from '../urls';

describe('test request and response objects', () => {
    setUrlParser(url.URL);

    it('test RequestBody methods', () => {
        const reqBody = new RequestBody({
            mode: 'urlencoded',
            formdata: [
                { key: 'formDataKey', value: 'formDataValue' },
            ],
            urlencoded: [
                { key: 'urlencodedKey', value: 'urlencodedValue' },
            ],
            options: {},
        });

        expect(reqBody.toString()).toEqual('urlencodedKey=urlencodedValue');

        reqBody.update({ mode: 'file', file: 'file content here' });
        expect(reqBody.toString()).toEqual('file content here');
    });

    it('test Request methods', () => {
        const req = new Request({
            url: 'https://hostname.com/path',
            method: 'GET',
            header: [
                { key: 'header1', value: 'val1' },
                { key: 'header2', value: 'val2' },
            ],
            body: {
                mode: 'raw',
                raw: 'body content',
            },
            auth: {
                type: 'basic',
                basic: [
                    { key: 'username', value: 'myname' },
                    { key: 'password', value: 'mypwd' },
                ],
            },
            proxy: undefined,
            certificate: undefined,
        });

        req.addHeader({ key: 'newHeader', value: 'newValue' });
        expect(req.headers.count()).toEqual(3);
        req.removeHeader('notExist', { ignoreCase: false });
        expect(req.headers.count()).toEqual(3);
        req.removeHeader('NEWHEADER', { ignoreCase: false });
        expect(req.headers.count()).toEqual(3);
        req.removeHeader('NEWHEADER', { ignoreCase: true });
        expect(req.headers.count()).toEqual(2);

        req.upsertHeader({ key: 'header1', value: 'new_val1' });
        expect(req.getHeaders({
            ignoreCase: true,
            enabled: true,
            multiValue: true,
            sanitizeKeys: true,
        })).toEqual({
            header1: ['new_val1'],
            header2: ['val2'],
        });

        const req2 = req.clone();
        expect(req2.toJSON()).toEqual(req.toJSON());
    });
});
