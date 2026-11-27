export interface GitMovedRequest {
  requestId: string;
  requestName: string;
  folderName: string;
  build: (moved: boolean) => string;
}
