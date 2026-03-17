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

let initialized = false;

export function initServices(impl: Services) {
  if (initialized) {
    throw new Error('Services have already been initialized.');
  }
  services = impl;
  initialized = true;
}

export let services: Services = new Proxy({} as Services, {
  get(_target) {
    throw new Error('Service not initialized. Call initServices() first.');
  },
});
