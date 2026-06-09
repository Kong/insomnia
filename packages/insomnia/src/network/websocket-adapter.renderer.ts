export const open = (options: any) => window.main.webSocket.open(options);
export const close = (options: { requestId: string }) => window.main.webSocket.close(options);
export const closeAll = () => window.main.webSocket.closeAll();
export const readyState = { getCurrent: (options: { requestId: string }) => window.main.webSocket.readyState.getCurrent(options) };
export const event = {
  findMany: (options: any) => window.main.webSocket.event.findMany(options),
  send: (options: any) => window.main.webSocket.event.send(options),
};
