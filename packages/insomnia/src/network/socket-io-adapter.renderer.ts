export const open = (options: any) => window.main.socketIO.open(options);
export const close = (options: { requestId: string }) => window.main.socketIO.close(options);
export const closeAll = () => window.main.socketIO.closeAll();
export const readyState = { getCurrent: (options: { requestId: string }) => window.main.socketIO.readyState.getCurrent(options) };
export const event = {
  findMany: (options: any) => window.main.socketIO.event.findMany(options),
  send: (options: any) => window.main.socketIO.event.send(options),
  on: (options: any) => window.main.socketIO.event.on(options),
  off: (options: any) => window.main.socketIO.event.off(options),
};
