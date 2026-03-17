import type { CaCertificate, McpPayload, McpRequest, McpResponse } from '~/insomnia-data';

export interface ModelMap {
  CaCertificate: CaCertificate;
  McpRequest: McpRequest;
  McpResponse: McpResponse;
  McpPayload: McpPayload;
}

export type AllTypes = keyof ModelMap;

export interface BaseServices<T extends AllTypes> {
  create(patch: Partial<ModelMap[T]>): Promise<ModelMap[T]>;
  getById(id: string): Promise<ModelMap[T] | undefined>;
  // TODO: consider if we should rename getByParentId to something more reasonable
  getByParentId(parentId: string): Promise<ModelMap[T] | undefined>;
  update(doc: ModelMap[T], patch: Partial<ModelMap[T]>): Promise<ModelMap[T]>;
  remove(doc: ModelMap[T]): Promise<void>;
  // TODO: consider if we should rename removeWhere to something more reasonable
  removeWhere(parentId: string): Promise<void>;
  all(): Promise<ModelMap[T][]>;
}
