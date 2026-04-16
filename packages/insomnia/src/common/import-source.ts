export const IMPORT_SOURCE_TYPES = ['file', 'uri', 'curl', 'clipboard', 'mcp'] as const;

export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];
