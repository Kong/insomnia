import { RawObject } from '../renderers/hidden-browser-window/inso-object';

type MessageHandler = (ev: MessageEvent) => Promise<void>;

export interface ScriptError {
    message: string;
    stack: string;
}

interface ScriptResultResolver {
    id: string;
    resolve: (value: RawObject) => void;
    reject: (error: ScriptError) => void;
}

const logPrefix = '[main][pre-request-script]';
const actionHandlers = new Map<string, MessageHandler>();
let hiddenBrowserWindowPort: MessagePort | undefined = undefined;
let scriptResultResolvers = new Array<ScriptResultResolver>();

async function publishPortHandler(ev: MessageEvent) {
    if (ev.ports.length === 0) {
        console.error(logPrefix, 'no port is found in the publishing port event');
        return;
    }

    hiddenBrowserWindowPort = ev.ports[0];

    hiddenBrowserWindowPort.onmessage = ev => {
        if (ev.data.action === 'message-channel://caller/respond') {
            if (!ev.data.id) {
                console.error(logPrefix, 'id is not specified in the executing script response message');
                return;
            }

            const callbackIndex = scriptResultResolvers.
                findIndex(callback => callback.id === ev.data.id);
            if (callbackIndex < 0) {
                console.error(logPrefix, `id(${ev.data.id}) is not found in the callback list`);
                return;
            }

            console.log(logPrefix, `found pre-request script resolver(id=${ev.data.id}) at index: ${callbackIndex}`);

            if (ev.data.result) {
                scriptResultResolvers[callbackIndex].resolve(ev.data.result);
            } else if (ev.data.error) {
                scriptResultResolvers[callbackIndex].reject(ev.data.error);
            } else {
                console.error(logPrefix, 'no data found in the message port response');
            }

            // skip previous ones for keeping it simple
            scriptResultResolvers = scriptResultResolvers.slice(callbackIndex + 1);
        } else if (ev.data.action === 'message-channel://caller/debug/respond') {
            if (ev.data.result) {
                window.localStorage.setItem(`test_result:${ev.data.id}`, JSON.stringify(ev.data.result));
                console.log(ev.data.result);
            } else {
                window.localStorage.setItem(`test_error:${ev.data.id}`, JSON.stringify(ev.data.error));
                console.error(logPrefix, ev.data.error);
            }
        } else if (ev.data.action === 'message-channel://consumers/close') {
            hiddenBrowserWindowPort?.close();
            hiddenBrowserWindowPort = undefined;
            console.log('[hidden win] hidden browser window port is closed');
        } else {
            console.error(logPrefix, `unknown action ${ev}`);
        }
    };

    console.log('[main][init hidden win step 6/6]: message port handler is set up in the main renderer');
};

async function waitUntilHiddenBrowserWindowReady() {
    window.hiddenBrowserWindow.start();

    // TODO: find a better way to wait for hidden browser window ready
    // the hiddenBrowserWindow may be still in starting
    // this is relatively simpler than receiving a 'ready' message from hidden browser window
    for (let i = 0; i < 100; i++) {
        if (hiddenBrowserWindowPort) {
            break;
        } else {
            await new Promise<void>(resolve => setTimeout(resolve, 100));
        }
    }

    console.error(logPrefix, 'the hidden window is still not ready');
};

async function debugEventHandler(ev: MessageEvent) {
    if (!hiddenBrowserWindowPort) {
        console.error(logPrefix, 'hidden browser window port is not inited, restarting');
        await waitUntilHiddenBrowserWindowReady();
    }

    console.info('sending script to hidden browser window');
    hiddenBrowserWindowPort?.postMessage({
        action: 'message-channel://hidden.browser-window/debug',
        options: {
            id: ev.data.id,
            code: ev.data.code,
            context: ev.data.context,
        },
    });
};

function register(actionName: string, handler: MessageHandler) {
    actionHandlers.set(actionName, handler);
};

export function registerWindowMessageHandlers() {
    register('message-event://renderers/publish-port', publishPortHandler);
    register('message-event://hidden.browser-window/debug', debugEventHandler);

    window.onmessage = (ev: MessageEvent) => {
        const action = ev.data.action;
        if (!action) {
            // could be react events
            return;
        }

        const handler = actionHandlers.get(action);
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

export async function runPreRequestScript(
    id: string,
    code: string,
    context: object,
): Promise<RawObject | undefined> {
    if (!hiddenBrowserWindowPort) {
        console.error(logPrefix, 'hidden browser window port is not inited, restarting');
        await waitUntilHiddenBrowserWindowReady();
    }

    const promise = new Promise<RawObject>((resolve, reject) => {
        console.log(logPrefix, `created pre-request script result resolver(id=${id})`);

        scriptResultResolvers.push({
            id,
            resolve,
            reject,
        });
    });

    hiddenBrowserWindowPort?.postMessage({
        action: 'message-channel://hidden.browser-window/execute',
        options: {
            id,
            code,
            context,
        },
    });

    return promise;
};

// export function getWindowMessageHandler() {
//     return windowMessageHandler;
// }
