import iconv from 'iconv-lite';

import { Response } from '../../models/response';
import { PluginTemplateFilter, PluginTemplateFilterContext } from '../extensions';

const getResponseBody = async (_ctx: PluginTemplateFilterContext, response: Response) => {
    const bodyBuffer = await _ctx.util.models.response.getBodyBuffer(response as { bodyPath?: string; bodyCompression?: 'zip' | null }, '');
    const match = response.contentType && response.contentType.match(/charset=([\w-]+)/);
    const charset = match && match.length >= 2 ? match[1] : 'utf-8';
    if (bodyBuffer) {
        // Sometimes iconv conversion fails so fallback to regular buffer
        try {
            return iconv.decode(bodyBuffer as Buffer, charset);
        } catch (err) {
            console.warn('[response] Failed to decode body', err);
            return bodyBuffer.toString();
        }
    }
    return '';
};

const currentResponseFilter: PluginTemplateFilter = {
    name: 'currentResponse',
    displayName: 'Get response of current request',
    args: [
        {
            displayName: 'Response type',
            type: 'enum',
            options: [
                { displayName: 'Latest', value: 0 },
                { displayName: '2nd latest', value: 1 },
                { displayName: '3rd latest', value: 2 },
                { displayName: '4th latest', value: 3 },
                { displayName: '5th latest', value: 4 },
                { displayName: 'Last success', value: -1 },
            ],
            defaultValue: '0',
        },
        {
            displayName: 'Include body',
            type: 'enum',
            options: [
                { displayName: 'None', value: '' },
                { displayName: 'JSON body', value: 'json' },
                { displayName: 'XML body', value: 'xml' },
                { displayName: 'Raw string body', value: 'raw' },
            ],
            defaultValue: '',
        },
    ],
    description: '',
    run: async function(_ctx: PluginTemplateFilterContext, value: any, type?: string, isIncludeBody?: string) {
        const topGet = type ? parseInt(type) : 0;
        let response: Response | null = null;
        if (topGet >= 0) {
            const responses = await _ctx.util.models.response.getAvailablesRequestId(_ctx.meta.requestId, topGet + 1, null);
            response = responses[topGet] || null;
        } else {
            const responses = await _ctx.util.models.response.getAvailablesRequestId(_ctx.meta.requestId, topGet, null);
            switch (topGet) {
                case -1: // last success
                    response = responses.find(res => res.statusCode === 200 || res.statusCode === 201) || null;
                    break;
                default: break;
            }
        }
        let body: any = null;
        if (isIncludeBody && response) {
            body = await getResponseBody(_ctx, (response as any));
            switch (isIncludeBody) {
                case 'json':
                    body = JSON.parse(body);
                    break;
                case 'xml':
                    const parser = new DOMParser();
                    body = parser.parseFromString(body, 'text/xml');
                    break;
                default: break;
            }
        }
        return {
            ...(response || {}),
            body,
            __previousValue: value,
        };
    },
};

export default currentResponseFilter;
