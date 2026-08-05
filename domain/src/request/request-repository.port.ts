import type { AnyRequest } from './any-request.entity';

export interface RequestRepository {
  findById(id: string): Promise<AnyRequest | null>;
  /** Queries all five request variants under this parentId and merges the results. */
  findByParentId(parentId: string): Promise<AnyRequest[]>;
  save(request: AnyRequest): Promise<void>;
  delete(id: string): Promise<void>;
}
