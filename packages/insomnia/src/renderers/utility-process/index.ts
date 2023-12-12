import { initPm } from './inso-object';

const executeAction = 'message-port://utility.process/execute';

async function init() {
    const channel = new MessageChannel();

    channel.port1.onmessage = async (ev: MessageEvent) => {
        const action = ev.data.action;

        if (action === executeAction || action === 'message-port://utility.process/debug') {
            try {
                const getPm = new Function('pm', 'return pm;');
                const rawPm = getPm(ev.data.options.context.pm);
                const pm = initPm(rawPm);
                const AsyncFunction = (async () => { }).constructor;
                const func = AsyncFunction(
                    'pm',
                    // TODO: support require function
                    // TODO: support async/await
                    `
                        ${ev.data.options.code};
                        return pm.toObject();
                    `
                );

                const result = await func(pm);
                channel.port1.postMessage({
                    action: action === executeAction ? 'message-port://caller/respond' : 'message-port://caller/debug/respond',
                    id: action === executeAction ? undefined : ev.data.options.id,
                    result,
                });
            } catch (e) {
                const message = e.message;
                const stacktrace = e.stacktrace;

                channel.port1.postMessage({
                    action: action === executeAction ? 'message-port://caller/respond' : 'message-port://caller/debug/respond',
                    id: action === executeAction ? undefined : ev.data.options.id,
                    error: JSON.stringify({ message, stacktrace }),
                });
            }
        } else {
            console.error(`unknown action ${ev.data}`);
        }
    };

    window.postMessage('message-event://preload/publish-port', '*', [channel.port2]);
}

init();
