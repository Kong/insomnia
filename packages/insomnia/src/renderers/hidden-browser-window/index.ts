import { initGlobalObject } from './inso-object';

const executeAction = 'message-channel://hidden.browser-window/execute';
const ErrorTimeout = 'execution timeout';

async function init() {
    const channel = new MessageChannel();
    channel.port1.onmessage = async (ev: MessageEvent) => {
        const action = ev.data.action;
        const timeout = ev.data.timeout ? ev.data.timeout : 3000;

        if (action === executeAction || action === 'message-channel://hidden.browser-window/debug') {
            try {
                const getRawGlobalObject = new Function('insomnia', 'return insomnia;');
                const rawObject = getRawGlobalObject(ev.data.options.context.insomnia);
                const insomniaObject = initGlobalObject(rawObject);

                const AsyncFunction = (async () => { }).constructor;
                const executeScript = AsyncFunction(
                    'insomnia',
                    `
                        return new Promise(async (resolve, reject) => {
                            const $ = insomnia;
                            const pm = insomnia;
                            const alertTimeout = () => reject({ message: '${ErrorTimeout}' });
                            const timeoutChecker = setTimeout(alertTimeout, ${timeout});

                            ${ev.data.options.code};

                            clearTimeout(timeoutChecker);
                            resolve(insomnia.toObject());
                        });
                    `
                );

                const result = await executeScript(
                    insomniaObject,
                );

                channel.port1.postMessage({
                    action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                    id: action === executeAction ? undefined : ev.data.options.id,
                    result,
                });
            } catch (e) {
                const message = e.message;

                channel.port1.postMessage({
                    action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                    id: action === executeAction ? undefined : ev.data.options.id,
                    error: JSON.stringify({ message }),
                });
            }
        } else {
            console.error(`unknown action ${ev.data}`);
        }
    }
        ;
    window.postMessage('message-event://preload/publish-port', '*', [channel.port2]);
}

init();
