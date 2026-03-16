import type { Services } from '~/insomnia-data';

import { caCertificateService } from './ca-certificate';
import { mcpPayloadService } from './mcp-payload';
import { mcpRequestService } from './mcp-request';
import { mcpResponseService } from './mcp-response';

export const servicesNodeImpl: Services = {
  caCertificate: caCertificateService,
  mcpRequest: mcpRequestService,
  mcpResponse: mcpResponseService,
  mcpPayload: mcpPayloadService,
};
