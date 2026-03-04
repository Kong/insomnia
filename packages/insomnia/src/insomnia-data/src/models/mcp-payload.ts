import type { BaseModel } from '~/models/types';

export const name = 'MCP Payload';

export const type = 'McpPayload';

export const prefix = 'mcp-payload';

export const canDuplicate = true;

export const canSync = false;

export interface BaseMcpPayload {
  params?: string | Record<string, any>;
  url: string;
}

export type McpPayload = BaseModel & BaseMcpPayload & { type: typeof type };

export const isMcpPayload = (model: Pick<BaseModel, 'type'>): model is McpPayload => model.type === type;

export const isMcpPayloadId = (id: string | null) => id?.startsWith(`${prefix}_`);

export const init = (): BaseMcpPayload => {
  return {
    params: {},
    url: '',
  };
};
