import type { Workspace, WorkspaceRepository } from 'insomnia-domain';

/**
 * Renames a workspace. Single-aggregate: reads and writes only through WorkspaceRepository.
 */
export async function renameWorkspace(
  workspaceRepository: WorkspaceRepository,
  workspaceId: string,
  name: string,
): Promise<Workspace> {
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const renamed: Workspace = { ...workspace, name, modified: Date.now() };
  await workspaceRepository.save(renamed);
  return renamed;
}
