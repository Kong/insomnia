import * as caCertificateService from './ca-certificate';
import * as mcpPayloadService from './mcp-payload';
import * as mcpRequestService from './mcp-request';
import * as mcpResponseService from './mcp-response';
import * as settingsService from './settings';

export const servicesNodeImpl = {
  caCertificate: caCertificateService,
  mcpRequest: mcpRequestService,
  mcpResponse: mcpResponseService,
  mcpPayload: mcpPayloadService,
  settings: settingsService,
} as const;
