import { describe, expect, it } from '@jest/globals';

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
            status: 'OK',
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
    });
});
