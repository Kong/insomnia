import * as caCertificateService from './ca-certificate';
import * as mcpPayloadService from './mcp-payload';
import * as mcpRequestService from './mcp-request';
import * as mcpResponseService from './mcp-response';
import * as settingsService from './settings';

// Services are consumed from renderer via preload -> IPC (`ipcRenderer.invoke`), so this contract
// must stay async across runtimes even if a main-process implementation could be synchronous.
// `satisfies` keeps the original inferred type while still producing compile-time errors for sync actions.
export const servicesNodeImpl = {
  caCertificate: caCertificateService,
  mcpRequest: mcpRequestService,
  mcpResponse: mcpResponseService,
  mcpPayload: mcpPayloadService,
  settings: settingsService,
} satisfies Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
