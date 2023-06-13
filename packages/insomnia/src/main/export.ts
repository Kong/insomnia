import electron from 'electron';
import fs, { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { version } from '../../package.json';
import { database as db } from '../common/database';
import { exportRequestsData } from '../common/export';
import * as models from '../models';
import { isGrpcRequest } from '../models/grpc-request';
import { isRequest } from '../models/request';
import { isWebSocketRequest } from '../models/websocket-request';
import { Workspace } from '../models/workspace';
export async function exportAllWorkspaces() {
  const exportAllToFile = async (activeProjectName: string, workspacesForActiveProject: Workspace[]) => {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const backupPath = path.join(dataPath, 'backups');
    await mkdir(backupPath, { recursive: true });
    const versionPath = path.join(backupPath, version);
    await mkdir(versionPath, { recursive: true });
    const fileName = path.join(versionPath, `${activeProjectName}.insomnia.json`);
    console.log('Exported project backup to:', fileName);
    const promises = workspacesForActiveProject.map(parentDoc => db.withDescendants(parentDoc));
    const docs = (await Promise.all(promises)).flat();
    const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc) || isWebSocketRequest(doc));
    const stringifiedExport = await exportRequestsData(requests, true, 'json');
    await fs.writeFile(fileName, stringifiedExport, {});
  };

  const allProjects = await models.project.all();
  await Promise.all(allProjects.map(async project => {
    const workspacesForActiveProject = await models.workspace.findByParentId(project._id);
    await exportAllToFile(project.name, workspacesForActiveProject);
  }));
}
