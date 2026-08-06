import type { CreateEnvironmentInput, Environment, EnvironmentRepository } from 'insomnia-domain';

export async function createEnvironment(
  environmentRepository: EnvironmentRepository,
  input: CreateEnvironmentInput,
): Promise<Environment> {
  return environmentRepository.create(input);
}
