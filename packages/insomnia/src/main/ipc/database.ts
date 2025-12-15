export interface DatabaseBridgeAPI {
  invoke: <T = any>(fnName: string, type: string, ...args: any[]) => Promise<T>;
}
