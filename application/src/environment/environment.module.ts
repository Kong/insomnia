import type { CreateEnvironmentInput, EnvironmentRepository } from 'insomnia-domain';

import { createEnvironment } from './create-environment.use-case';
import { deleteEnvironment } from './delete-environment.use-case';
import { updateEnvironment, type UpdateEnvironmentPatch } from './update-environment.use-case';

export class EnvironmentModule {
  constructor(private readonly environmentRepository: EnvironmentRepository) {}

  create(input: CreateEnvironmentInput) {
    return createEnvironment(this.environmentRepository, input);
  }

  updateById(id: string, patch: UpdateEnvironmentPatch) {
    return updateEnvironment(this.environmentRepository, id, patch);
  }

  deleteById(id: string, workspaceId: string) {
    return deleteEnvironment(this.environmentRepository, id, workspaceId);
  }
}
