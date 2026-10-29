export interface GitEntityTypeNames {
  folder: string;
  request: string;
  webSocket: string;
  socketIo: string;
  grpc: string;
  mockRoute: string;
  mcp: string;
}

export interface GitEntityTypeFiles {
  names: GitEntityTypeNames;
  build: (changed: boolean) => { collection: string; mock: string; mcp: string };
}
