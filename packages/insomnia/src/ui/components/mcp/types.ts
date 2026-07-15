import type { Prompt, Resource, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpServerPrimitiveTypes } from 'insomnia-data';

interface CommonItemProps {
  itemLevel: number;
  hide: boolean;
  collapsed?: boolean;
}

export interface ToolItem extends Tool, CommonItemProps {
  type: 'tools';
}
export interface ResourceItem extends Resource, CommonItemProps {
  type: 'resources';
}
export interface ResourceTemplateItem extends ResourceTemplate, CommonItemProps {
  type: 'resourceTemplates';
}
export interface PromptItem extends Prompt, CommonItemProps {
  type: 'prompts';
}
export type PrimitiveSubItem = ToolItem | ResourceItem | ResourceTemplateItem | PromptItem;
export interface PrimitiveTypeItem extends CommonItemProps {
  type: McpServerPrimitiveTypes;
  name: string;
  nextCursor?: string;
}
