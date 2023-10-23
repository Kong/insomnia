import { ipcMain } from 'electron/main';

export interface MigrationBridgeAPI {
    start: () => void;
    pause: () => void;
    resume: () => void;
    end: () => void;
    progress: () => void;
    // open: (options: OpenWebSocketRequestOptions) => void;
    // close: typeof closeWebSocketConnection;
    // closeAll: typeof closeAllWebSocketConnections;
    // readyState: {
    //     getCurrent: typeof getWebSocketReadyState;
    // };
    // event: {
    //     findMany: typeof findMany;
    //     send: typeof sendWebSocketEvent;
    // };
}

export const registerMigrationHandlers = () => {
    // ipcMain.handle('webSocket.open', openWebSocketConnection);
    // ipcMain.handle('webSocket.event.send', (_, options: Parameters<typeof sendWebSocketEvent>[0]) => sendWebSocketEvent(options));
    // ipcMain.on('webSocket.close', (_, options: Parameters<typeof closeWebSocketConnection>[0]) => closeWebSocketConnection(options));
    // ipcMain.on('webSocket.closeAll', closeAllWebSocketConnections);
    // ipcMain.handle('webSocket.readyState', (_, options: Parameters<typeof getWebSocketReadyState>[0]) => getWebSocketReadyState(options));
    // ipcMain.handle('webSocket.event.findMany', (_, options: Parameters<typeof findMany>[0]) => findMany(options));
};
