import type { Environment, EnvironmentRepository } from 'insomnia-domain';

export type UpdateEnvironmentPatch = Partial<Omit<Environment, '_id' | 'type' | 'parentId' | 'created'>>;

export async function updateEnvironment(
  environmentRepository: EnvironmentRepository,
  environmentId: string,
  patch: UpdateEnvironmentPatch,
): Promise<Environment> {
  const environment = await environmentRepository.findById(environmentId);
  if (!environment) {
    throw new Error(`Environment not found: ${environmentId}`);
  }
  const updated: Environment = { ...environment, ...patch, modified: Date.now() };
  await environmentRepository.save(updated);
  return updated;
}
