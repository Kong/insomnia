import type { Workspace, WorkspaceRepository } from 'insomnia-domain';

export async function moveWorkspace(
  workspaceRepository: WorkspaceRepository,
  workspaceId: string,
  projectId: string,
): Promise<Workspace> {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  const moved: Workspace = { ...workspace, parentId: projectId, modified: Date.now() };
  await workspaceRepository.save(moved);
  return moved;
}
