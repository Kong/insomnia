import { Settings } from '../../src/models/settings';
import { Row } from '../../src/renderers/hidden-browser-window/sdk-objects/console';
import { RequestBodyMode } from '../../src/renderers/hidden-browser-window/sdk-objects/req-resp';
import { transformToPreRequestAuth } from '../../src/renderers/hidden-browser-window/sdk-objects/send-req';
import { ClientCertificate } from '../models/client-certificate';
import type { Request } from '../models/request';
import { RawObject } from '../renderers/hidden-browser-window/inso-object';

type MessageHandler = (ev: MessageEvent) => Promise<void>;

const logPrefix = '[main][pre-request-script]';
export interface ScriptError {
    message: string;
    stack: string;
}

export interface ScriptExecutionResult {
    context: RawObject;
    outputs: Row[];
}

interface ScriptResultResolver {
    id: string;
    resolve: (value: ScriptExecutionResult) => void;
    reject: (error: ScriptError) => void;
}

// WindowMessageHandler handles entities in followings domains:
// - handle window message events
// - handle message port events
// - trigger message callbacks
class WindowMessageHandler {
    private hiddenBrowserWindowPort: MessagePort | undefined;
    private actionHandlers: Map<string, MessageHandler> = new Map();
    private scriptResultResolvers: ScriptResultResolver[] = [];

    constructor() { }

    publishPortHandler = async (ev: MessageEvent) => {
        if (ev.ports.length === 0) {
            console.error(logPrefix, 'no port is found in the publishing port event');
            return;
        }

        this.hiddenBrowserWindowPort = ev.ports[0];

        this.hiddenBrowserWindowPort.onmessage = ev => {
            if (ev.data.action === 'message-channel://caller/respond') {
                if (!ev.data.id) {
                    console.error(logPrefix, 'id is not specified in the executing script response message');
                    return;
                }

                const callbackIndex = this.scriptResultResolvers.
                    findIndex(callback => callback.id === ev.data.id);
                if (callbackIndex < 0) {
                    console.error(logPrefix, `id(${ev.data.id}) is not found in the callback list`);
                    return;
                }

                console.log(logPrefix, `found pre-request script resolver(id=${ev.data.id}) at index: ${callbackIndex}`);

                if (ev.data.result) {
                    this.scriptResultResolvers[callbackIndex].resolve(ev.data.result);
                } else if (ev.data.error) {
                    this.scriptResultResolvers[callbackIndex].reject(ev.data.error);
                } else {
                    console.error(logPrefix, 'no data found in the message port response');
                }

                // skip previous ones for keeping it simple
                for (let i = 0; i < callbackIndex; i++) {
                    this.scriptResultResolvers[i].reject({
                        message: 'The request has been canceled',
                        stack: '',
                    });
                }
                this.scriptResultResolvers = this.scriptResultResolvers.slice(callbackIndex + 1);
            } else if (ev.data.action === 'message-channel://caller/debug/respond') {
                if (ev.data.result) {
                    window.localStorage.setItem(`test_result:${ev.data.id}`, JSON.stringify(ev.data.result));
                    console.log(ev.data.result);
                } else {
                    window.localStorage.setItem(`test_error:${ev.data.id}`, JSON.stringify(ev.data.error));
                    console.error(logPrefix, ev.data.error);
                }
            } else if (ev.data.action === 'message-channel://consumers/close') {
                this.hiddenBrowserWindowPort?.close();
                this.hiddenBrowserWindowPort = undefined;
                console.log('[hidden win] hidden browser window port is closed');
            } else {
                console.error(logPrefix, `unknown action ${ev}`);
            }
        };

        console.log('[main][init hidden win step 6/6]: message port handler is set up in the main renderer');
    };

    waitUntilHiddenBrowserWindowReady = async () => {
        window.hiddenBrowserWindow.start();

        // TODO: find a better way to wait for hidden browser window ready
        // the hiddenBrowserWindow may be still in starting
        // this is relatively simpler than receiving a 'ready' message from hidden browser window
        for (let i = 0; i < 100; i++) {
            if (this.hiddenBrowserWindowPort) {
                break;
            } else {
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
        }

        console.error(logPrefix, 'the hidden window is still not ready');
    };

    debugEventHandler = async (ev: MessageEvent) => {
        if (!this.hiddenBrowserWindowPort) {
            console.error(logPrefix, 'hidden browser window port is not inited, restarting');
            await this.waitUntilHiddenBrowserWindowReady();
        }

        console.info('sending script to hidden browser window');
        this.hiddenBrowserWindowPort?.postMessage({
            action: 'message-channel://hidden.browser-window/debug',
            options: {
                id: ev.data.id,
                code: ev.data.code,
                context: ev.data.context,
            },
        });
    };

    register = (actionName: string, handler: MessageHandler) => {
        this.actionHandlers.set(actionName, handler);
    };

    start = () => {
        window.hiddenBrowserWindow.start();

        this.register('message-event://renderers/publish-port', this.publishPortHandler);
        this.register('message-event://hidden.browser-window/debug', this.debugEventHandler);

        window.onmessage = (ev: MessageEvent) => {
            const action = ev.data.action;
            if (!action) {
                // could be react events
                return;
            }

            const handler = this.actionHandlers.get(action);
            if (!handler) {
                console.error(logPrefix, `no handler is found for action ${action}`);
                return;
            }

            try {
                handler(ev);
            } catch (e) {
                console.error(logPrefix, `failed to handle event message (${ev.data.action}): ${e.message}`);
            }
        };
    };

    runPreRequestScript = async (
        id: string,
        code: string,
        context: object,
        request: Request,
        settings: Settings,
        clientCertificates: ClientCertificate[],
    ): Promise<ScriptExecutionResult | undefined> => {
        if (!this.hiddenBrowserWindowPort) {
            console.error(logPrefix, 'hidden browser window port is not inited, restarting');
            await this.waitUntilHiddenBrowserWindowReady();
        }

        const promise = new Promise<ScriptExecutionResult>((resolve, reject) => {
            console.log(logPrefix, `created pre-request script result resolver(id=${id})`);

            this.scriptResultResolvers.push({
                id,
                resolve,
                reject,
            });
        });

        // TODO: transform Insomnia request to pre-request script request object
        let requestBodyMode: RequestBodyMode = undefined;
        if (request.body.fileName) {
            requestBodyMode = 'file';
        } else if (request.body.text) {
            requestBodyMode = 'raw';
        } else if (request.body.params) {
            requestBodyMode = 'urlencoded';
        }

        const requestBodyObj = {
            mode: requestBodyMode,
            file: request.body.fileName,
            formdata: undefined, // TODO: also hook this to params
            graphql: undefined, // TODO: also hook gql requests
            raw: request.body.text,
            urlencoded: request.body.params?.map(param => ({ key: param.name, value: param.value })),
        };

        let proxyUrl = { host: '', port: '' };
        if (settings.proxyEnabled &&
            (URL.canParse(settings.httpsProxy) || URL.canParse(settings.httpProxy))
        ) {
            proxyUrl = new URL(settings.httpsProxy || settings.httpProxy);
        }
        const firstClientCert = clientCertificates != null && clientCertificates.length > 0 ? clientCertificates[0] : undefined;

        const requestObj = {
            url: request.url,
            method: request.method,
            header: request.headers.map(header => ({
                key: header.name,
                value: header.value,
                disabled: header.disabled,
            })),
            body: requestBodyObj,
            auth: transformToPreRequestAuth(request.authentication.type),
            proxy: {
                // TODO: currently most of configs are not supported in Insomnia
                match: '<all_urls>',
                host: proxyUrl.host,
                port: proxyUrl.port,
                tunnel: false,
                disabled: !settings.proxyEnabled,
                authenticate: false,
                username: '',
                password: '',
            },
            certificate: firstClientCert ? {
                // TODO: some fields are not supported in Insomnia
                // name?: string;
                // matches?: string[];
                key: { src: firstClientCert.key },
                cert: { src: firstClientCert.cert },
                passphrase: firstClientCert.passphrase,
                pfx: { src: firstClientCert.pfx },
            } : undefined,
        };

        this.hiddenBrowserWindowPort?.postMessage({
            action: 'message-channel://hidden.browser-window/execute',
            options: {
                id,
                code,
                context,
                requestObj,
                settings,
            },
        });

        return promise;
    };
}

const windowMessageHandler = new WindowMessageHandler();
export function getWindowMessageHandler() {
    return windowMessageHandler;
}
