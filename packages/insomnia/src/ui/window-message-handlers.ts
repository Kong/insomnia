import { RawObject } from '../renderers/hidden-browser-window/inso-object';

type MessageHandler = (ev: MessageEvent) => Promise<void>;

const logPrefix = '[main][pre-request-script]';
export interface ScriptError {
    message: string;
    stack: string;
}

interface ScriptResultResolver {
    id: string;
    resolve: (value: RawObject) => void;
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
    ): Promise<RawObject | undefined> => {
        if (!this.hiddenBrowserWindowPort) {
            console.error(logPrefix, 'hidden browser window port is not inited, restarting');
            await this.waitUntilHiddenBrowserWindowReady();
        }

        const promise = new Promise<RawObject>((resolve, reject) => {
            console.log(logPrefix, `created pre-request script result resolver(id=${id})`);

            this.scriptResultResolvers.push({
                id,
                resolve,
                reject,
            });
        });

        this.hiddenBrowserWindowPort?.postMessage({
            action: 'message-channel://hidden.browser-window/execute',
            options: {
                id,
                code,
                context,
            },
        });

        return promise;
    };
}

const windowMessageHandler = new WindowMessageHandler();
export function getWindowMessageHandler() {
    return windowMessageHandler;
}
