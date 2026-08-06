import type { EnvironmentRepository } from 'insomnia-domain';

export async function deleteEnvironment(
  environmentRepository: EnvironmentRepository,
  environmentId: string,
  workspaceId: string,
): Promise<void> {
  const environment = await environmentRepository.findById(environmentId);
  if (!environment) {
    throw new Error(`Environment not found: ${environmentId}`);
  }
  if (environment.parentId === workspaceId) {
    throw new Error('Cannot delete base environment');
  }
  await environmentRepository.delete(environmentId);
}
