import type { Prompt, Resource, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { McpServerPrimitiveTypes } from '../../../models/mcp-request';

interface CommonItemProps {
  itemLevel: number;
  hide: boolean;
}

export type ToolItem = Tool & { type: 'tools' } & CommonItemProps;
export type ResourceItem = Resource & { type: 'resources' } & CommonItemProps;
export type ResourceTemplateItem = ResourceTemplate & { type: 'resources' } & CommonItemProps;
export type PromptItem = Prompt & { type: 'prompts' } & CommonItemProps;
export type PrimitiveSubItem = ToolItem | ResourceItem | ResourceTemplateItem | PromptItem;
export interface PrimitiveTypeItem extends CommonItemProps {
  type: McpServerPrimitiveTypes;
  name: string;
}
