/** The primitive kinds a sidebar row can belong to (the prefix of its `data-key`). */
export enum McpPrimitiveType {
  Tools = 'tools',
  Resources = 'resources',
  Prompts = 'prompts',
  ResourceTemplates = 'resourceTemplates',
}

/** The capability items of the MCP sidebar; Resource Templates are listed under `resources`. */
export type McpCapabilityType = Exclude<McpPrimitiveType, McpPrimitiveType.ResourceTemplates>;

/** The list action a capability item's menu offers. */
export enum McpListAction {
  Reload = 'Reload',
  LoadMore = 'Load More',
}
