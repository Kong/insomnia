import type { Environment } from './environment.entity';

export interface EnvironmentRepository {
  findById(id: string): Promise<Environment | null>;
  /** Environment's parent is either a Workspace (base environment) or another Environment (sub-environment). */
  findByParentId(parentId: string): Promise<Environment[]>;
  save(environment: Environment): Promise<void>;
  delete(id: string): Promise<void>;
}
