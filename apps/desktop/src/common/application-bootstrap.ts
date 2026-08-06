// Wires concrete infrastructure adapters to application use-cases. Per the architecture plan,
// this kind of wiring belongs only in each app's own bootstrap code, never scattered through
// routes/commands. Location here is provisional - where each app's bootstrap code should live is
// still an open decision; this file exists to have exactly one place doing this wiring today.
import { renameWorkspace as renameWorkspaceUseCase } from 'application';
import { nedbWorkspaceRepository } from 'infrastructure';

export const renameWorkspace = (workspaceId: string, name: string) =>
  renameWorkspaceUseCase(nedbWorkspaceRepository, workspaceId, name);
