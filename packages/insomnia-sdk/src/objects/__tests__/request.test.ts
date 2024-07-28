import { describe, expect, it } from 'vitest';

import { mergeRequestBody, Request, RequestBody, toScriptRequestBody } from '../request';

describe('test request and response objects', () => {
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
            name: 'myReq',
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

        expect(req.name).toEqual('myReq');

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

    it('test Request body transforming', () => {
        const bodies = [
            {
                mimeType: 'text/plain',
                text: 'rawContent',
            },
            {
                mimeType: 'application/octet-stream',
                fileName: 'path/to/file',
            },
            {
                mimeType: 'application/x-www-form-urlencoded',
                params: [
                    { name: 'k1', value: 'v1' },
                    { name: 'k2', value: 'v2' },
                ],
            },
            {
                mimeType: 'application/json',
                text: `{
                    query: 'query',
                    operationName: 'operation',
                    variables: 'var',
                }`,
            },
            {
                mimeType: 'image/gif',
                fileName: '/path/to/image',
            },
            {
                mimeType: 'multipart/form-data',
                params: [
                    { name: 'k1', type: 'text', value: 'v1' },
                    { name: 'k2', type: 'file', value: '/path/to/image' },
                ],
            },
        ];

        bodies.forEach(body => {
            const originalReqBody = body;
            const scriptReqBody = new RequestBody(toScriptRequestBody(body));
            expect(mergeRequestBody(scriptReqBody, originalReqBody)).toEqual(originalReqBody);
        });
    });
});
