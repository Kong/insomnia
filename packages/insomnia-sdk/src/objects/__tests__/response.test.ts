import { describe, expect, it } from 'vitest';

import { Request } from '../request';
import { Response } from '../response';

describe('test request and response objects', () => {
    it('test Response methods', () => {
        const req = new Request({
            url: 'https://hostname.com/path',
            method: 'GET',
            header: [
                { key: 'header1', value: 'val1' },
                { key: 'header2', value: 'val2' },
            ],
            body: {
                mode: 'raw',
                raw: '{"key": 888}',
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

        const resp = new Response({
            code: 200,
            reason: 'OK',
            header: [
                { key: 'header1', value: 'val1' },
                { key: 'header2', value: 'val2' },
                { key: 'Content-Length', value: '100' },
                { key: 'Content-Disposition', value: 'attachment; filename="filename.txt"' },
                { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
            ],
            cookie: [
                { key: 'header1', value: 'val1' },
                { key: 'header2', value: 'val2' },
            ],
            body: '{"key": 888}',
            stream: undefined,
            responseTime: 100,
            originalRequest: req,
        });

        // TODO: this will work after PropertyList.one is improved
        // expect(resp.size()).toBe(100);

        expect(resp.json()).toEqual({
            key: 888,
        });
        expect(resp.contentInfo()).toEqual({
            charset: 'utf-8',
            contentType: 'text/plain; charset=utf-8',
            fileExtension: 'txt',
            fileName: 'filename',
            mimeFormat: '',
            mimeType: 'text/plain',
        });

        // extended assertion chains
        resp.to.have.status(200);
        resp.to.have.status('OK');
        resp.to.have.header('header1');
        resp.to.have.jsonBody({ 'key': 888 });
        resp.to.have.body('{"key": 888}');
        resp.to.have.jsonSchema({
            type: 'object',
            properties: {
                key: { type: 'integer' },
            },
            required: ['key'],
            additionalProperties: false,
        });

        resp.to.not.have.status(201);
        resp.to.not.have.status('NOT FOUND');
        resp.to.not.have.header('header_nonexist');
        resp.to.not.have.jsonBody({ 'key': 777 });
        resp.to.not.have.body('{"key": 777}');
        resp.to.not.have.jsonSchema({
            type: 'object',
            properties: {
                keyNoExist: { type: 'integer' },
            },
            required: ['keyNoExist'],
            additionalProperties: false,
        });
    });
});
