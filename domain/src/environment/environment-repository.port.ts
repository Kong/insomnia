import type { Environment, EnvironmentType } from './environment.entity';

export interface CreateEnvironmentInput {
  /** Either a Workspace (base environment) or another Environment (sub-environment). */
  parentId: string;
  name?: string;
  isPrivate?: boolean;
  environmentType?: EnvironmentType;
}

export interface EnvironmentRepository {
  findById(id: string): Promise<Environment | null>;
  /** Environment's parent is either a Workspace (base environment) or another Environment (sub-environment). */
  findByParentId(parentId: string): Promise<Environment[]>;
  create(input: CreateEnvironmentInput): Promise<Environment>;
  save(environment: Environment): Promise<void>;
  delete(id: string): Promise<void>;
}
