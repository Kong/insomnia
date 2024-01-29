import { initGlobalObject, InsomniaObject } from './inso-object';
import { require } from './sdk-objects/require';

const ErrorTimeout = 'executing script timeout';
const ErrorInvalidResult = 'result is invalid, null or custom value may be returned';

const executeAction = 'message-channel://hidden.browser-window/execute';

async function init() {
    const channel = new MessageChannel();

    channel.port1.onmessage = async (ev: MessageEvent) => {
        const action = ev.data.action;
        const timeout = ev.data.timeout ? ev.data.timeout : 3000;

        try {
            if (action === executeAction || action === 'message-channel://hidden.browser-window/debug') {
                const getRawGlobalObject = new Function('insomnia', 'return insomnia;');
                const rawObject = getRawGlobalObject(ev.data.options.context.insomnia);
                const settings = ev.data.options.settings;
                const insomniaObject = initGlobalObject(rawObject, settings);

                const AsyncFunction = (async () => { }).constructor;
                const executeScript = AsyncFunction(
                    'insomnia',
                    'require',
                    // isolate DOM objects
                    // window properties
                    'closed', /* 'console', */ 'credentialless', 'customElements', 'devicePixelRatio', 'document', 'documentPictureInPicture', 'event', 'external', 'frameElement', 'frames', 'fullScreen', 'history', 'innerHeight', 'innerWidth', 'launchQueue', 'length', 'localStorage', 'location', 'locationbar', 'menubar', 'name', 'navigation', 'navigator', 'opener', 'orientation', 'originAgentCluster', 'outerHeight', 'outerWidth', 'parent', 'personalbar', 'screen', 'screenLeft', 'screenTop', 'screenX', 'screenY', 'scrollbars', 'scrollMaxX', 'scrollMaxY', 'scrollX', 'scrollY', 'self', 'sessionStorage', 'sharedStorage', 'sidebar', 'speechSynthesis', 'status', 'statusbar', 'toolbar', 'top', 'visualViewport', 'window',
                    // window methods
                    'alert', 'backalert', 'bluralert', 'cancelAnimationFramealert', 'cancelIdleCallbackalert', 'captureEventsalert', 'clearImmediatealert', 'closealert', 'confirmalert', 'dumpalert', 'findalert', 'focusalert', 'forwardalert', 'getComputedStylealert', 'getDefaultComputedStylealert', 'getScreenDetailsalert', 'getSelectionalert', 'matchMediaalert', 'moveByalert', 'moveToalert', 'openalert', 'postMessagealert', 'printalert', 'promptalert', 'queryLocalFontsalert', 'releaseEventsalert', 'requestAnimationFramealert', 'requestFileSystemalert', 'requestIdleCallbackalert', 'resizeByalert', 'resizeToalert', 'scrollalert', 'scrollByalert', 'scrollByLinesalert', 'scrollByPagesalert', 'scrollToalert', 'setImmediatealert', 'setResizablealert', 'showDirectoryPickeralert', 'showModalDialogalert', 'showOpenFilePickeralert', 'showSaveFilePickeralert', 'sizeToContentalert', 'stopalert', 'updateCommandsalert', 'webkitConvertPointFromNodeToPagealert', 'webkitConvertPointFromPageToNodealert',
                    // if possible, avoid adding code to the following part
                    `
                        const $ = insomnia, pm = insomnia;
                        ${ev.data.options.code};

                        return insomnia;
                    `
                );

                const result = await new Promise(async (resolve, reject) => {
                    const alertTimeout = () => reject({ message: `${ErrorTimeout}:${timeout}ms` });
                    const timeoutChecker = setTimeout(alertTimeout, timeout);

                    try {
                        const insoObject = await executeScript(
                            insomniaObject,
                            require,
                            // window properties
                            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
                            // window methods
                            undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
                        );
                        clearTimeout(timeoutChecker);
                        if (insoObject instanceof InsomniaObject) {
                            resolve(insoObject.toObject());
                        } else {
                            throw { message: ErrorInvalidResult };
                        }

                    } catch (e) {
                        reject(e);
                    }
                });

                channel.port1.postMessage({
                    action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                    id: ev.data.options.id,
                    result,
                });
            } else {
                console.error(`unknown action ${ev.data}`);
            }
        } catch (e) {
            channel.port1.postMessage({
                action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                id: ev.data.options.id,
                error: {
                    message: e.message || 'unknown error',
                    stack: e.stack,
                },
            });
        }
    };

    window.postMessage('message-event://preload/publish-port', '*', [channel.port2]);
    console.log('[hidden-browser-window][init hidden win step 4/6]: message channel is created');

    window.onbeforeunload = () => {
        channel.port1.postMessage({
            action: 'message-channel://consumers/close',
        });
    };
}

init();
