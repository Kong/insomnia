import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { workspace } from '../models';
import type { Workspace } from '../models/workspace';
import { database } from './database';
import { getInsomniaV5DataExport } from './insomnia-v5';

export async function exportWorkspaceData({
  workspaceId,
  dirPath,
}: {
  workspaceId: string;
  dirPath: string;
}) {
  const insomniaExport = await getInsomniaV5DataExport(workspaceId);

  try {
    const workspaceName = workspace.name.replace(/ /g, '-');
    const filePath = path.join(dirPath, `${workspaceName}-${workspaceId}.yaml`);
    await writeFile(filePath, JSON.stringify(insomniaExport));
  } catch (error) {
    console.error(error);
  }
}

export async function exportAllData({
  dirPath,
}: {
  dirPath: string;
}): Promise<void> {
  const insomniaExportFolder = path.join(dirPath, `insomnia-export.${Date.now()}`);
  await mkdir(insomniaExportFolder);

  const workspaces = await database.find<Workspace>(workspace.type);

  for (const workspace of workspaces) {
    await exportWorkspaceData({
      workspaceId: workspace._id,
      dirPath: insomniaExportFolder,
    });
  }
}
