import { type CaCertificateService } from './ca-certificate';
import { type McpPayloadService } from './mcp-payload';
import { type McpRequestService } from './mcp-request';
import { type McpResponseService } from './mcp-response';

export interface Services {
  caCertificate: CaCertificateService;
  mcpRequest: McpRequestService;
  mcpResponse: McpResponseService;
  mcpPayload: McpPayloadService;
}

export function initServices(impl: Services) {
  services = impl;
}

export let services: Services = new Proxy({} as Services, {
  get(_target) {
    throw new Error('Service not initialized. Call initServices() first.');
  },
});
