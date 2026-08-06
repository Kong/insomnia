import type { EnvironmentRepository, RequestRepository, WorkspaceRepository } from 'insomnia-domain';

import { EnvironmentModule } from './environment/environment.module';
import { RequestModule } from './request/request.module';
import { WorkspaceModule } from './workspace/workspace.module';

/**
 * Concrete infrastructure adapters this app-level facade needs. Each app's own bootstrap code
 * constructs these (which repository implementation, which secret-storage adapter, etc.) and
 * passes them in here - this interface only names *what* is needed, never a concrete class, so
 * `application` stays dependency-free of `infrastructure`.
 */
export interface InsomniaDependencies {
  workspaceRepository: WorkspaceRepository;
  environmentRepository: EnvironmentRepository;
  requestRepository: RequestRepository;
}

/**
 * The single entry point apps use to reach application use-cases, namespaced by aggregate
 * (`insomnia.workspace`, `insomnia.request`, ...). One instance is constructed once, in each
 * app's own bootstrap code, and threaded through from there (e.g. via React Router context) -
 * never constructed per-call or scattered through routes/commands.
 */
export class Insomnia {
  workspace: WorkspaceModule;
  environment: EnvironmentModule;
  request: RequestModule;

  constructor(dependencies: InsomniaDependencies) {
    this.workspace = new WorkspaceModule(dependencies.workspaceRepository);
    this.environment = new EnvironmentModule(dependencies.environmentRepository);
    this.request = new RequestModule(dependencies.requestRepository);
  }
}
