import type { CreateWorkspaceInput, Workspace, WorkspaceRepository } from 'insomnia-domain';

export async function createWorkspace(
  workspaceRepository: WorkspaceRepository,
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  return workspaceRepository.create(input);
}
