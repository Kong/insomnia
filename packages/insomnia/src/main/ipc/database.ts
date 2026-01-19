export interface DatabaseBridgeAPI {
  invoke: <T = any>(fnName: string, ...args: any[]) => Promise<T>;
}
