import { configure, type ConfigureOptions, type Environment as NunjuncksEnv } from 'nunjucks';

export class PmHttpRequest {
    public name: string;
    constructor(_: {}, name?: string) {
        this.name = name || '';
    }
}

export interface PmHttpResponse {
    code: number;
}

// common modules
class PmHttpRequestSender {
    constructor() { }

    sendRequest = async (req: string | PmHttpRequest, callback: (e?: Error, resp?: PmHttpResponse) => void): Promise<void> => {
        if (typeof (req) === 'string') {
            // simple request
            return fetch(req)
                .then(rawResp => {
                    // TODO: init all response fields
                    const resp = {
                        code: rawResp.status,
                    };

                    callback(
                        undefined,
                        resp,
                    );
                })
                .catch(err => {
                    callback(err);
                });
        }
        // TODO:
        return;
    };
}

export interface HttpRequestSender {
    sendRequest: (req: string | PmHttpRequest, callback: (e?: Error, resp?: PmHttpResponse) => void) => Promise<void>;
}

const httpRequestSender = new PmHttpRequestSender();
export function getHttpRequestSender() {
    return httpRequestSender;
}

class Intepolator {
    private engine: NunjuncksEnv;

    constructor(config: ConfigureOptions) {
        this.engine = configure(config);
    }

    render = (template: string, context: object) => {
        // TODO: handle timeout
        // TODO: support plugin?
        return this.engine.renderString(template, context);
    };
}

const intepolator = new Intepolator({
    autoescape: false,
    // Don't escape HTML
    throwOnUndefined: true,
    // Strict mode
    tags: {
        blockStart: '{%',
        blockEnd: '%}',
        variableStart: '{{',
        variableEnd: '}}',
        commentStart: '{#',
        commentEnd: '#}',
    },
});

export function getIntepolator() {
    return intepolator;
}
