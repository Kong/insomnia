
type MessageHandler = (ev: MessageEvent) => Promise<void>;

class WindowMessageHandler {
    private utilityProcessPort: MessagePort | undefined;
    private actionHandlers: Map<string, MessageHandler> = new Map();

    constructor() { }

    publishPortHandler = async (ev: MessageEvent) => {
        if (ev.ports.length === 0) {
            console.error('no port is found in the publishing port event');
            return;
        }

        this.utilityProcessPort = ev.ports[0];

        this.utilityProcessPort.onmessage = ev => {
            if (ev.data.action === 'message-port://caller/respond') {
                // TODO: hook to UI and display result
                console.log('[main] result from utility process:', ev.data.result);
            } else if (ev.data.action === 'message-port://caller/debug/respond') {
                if (ev.data.result) {
                    window.localStorage.setItem(`test_result:${ev.data.id}`, JSON.stringify(ev.data.result));
                } else {
                    window.localStorage.setItem(`test_error:${ev.data.id}`, JSON.stringify(ev.data.error));
                }
            } else {
                console.error(`unknown action ${ev}`);
            }
        };
    };

    debugEventHandler = async (ev: MessageEvent) => {
        if (!this.utilityProcessPort) {
            console.error('utility process port is not inited');
            return;
        }

        this.utilityProcessPort.postMessage({
            action: 'message-port://utility.process/debug',
            options: {
                id: ev.data.id,
                code: ev.data.code,
                context: ev.data.context,
            },
        });
    };

    // startUtilityProcessHandler = async (ev: MessageEvent) => {
    // };

    register = (actionName: string, handler: MessageHandler) => {
        this.actionHandlers.set(actionName, handler);
    };

    start = () => {
        this.register('message-event://renderers/publish-port', this.publishPortHandler);
        this.register('message-event://utility.process/debug', this.debugEventHandler);

        window.onmessage = (ev: MessageEvent) => {
            const action = ev.data.action;
            if (!action) {
                // could be react events
                return;
            }

            const handler = this.actionHandlers.get(action);
            if (!handler) {
                console.error(`no handler is found for action ${action}`);
                return;
            }

            try {
                handler(ev);
            } catch (e) {
                console.error(`failed to handle event message (${ev.data.action}): ${e.message}`);
            }
        };
    };

    stop = () => {
        this.actionHandlers.clear();
    };
}

const windowMessageHandler = new WindowMessageHandler();
export function getWindowMessageHandler() {
    return windowMessageHandler;
}
