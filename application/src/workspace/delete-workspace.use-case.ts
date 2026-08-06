import type { WorkspaceRepository } from 'insomnia-domain';

export async function deleteWorkspace(workspaceRepository: WorkspaceRepository, workspaceId: string): Promise<void> {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  await workspaceRepository.delete(workspaceId);
}
