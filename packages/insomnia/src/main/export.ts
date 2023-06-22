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
export async function exportAllWorkspaces() {
  const projects = await models.project.all();
  await Promise.all(projects.map(async project => {
    const dataPath = process.env['INSOMNIA_DATA_PATH'] || electron.app.getPath('userData');
    const versionPath = path.join(dataPath, 'backups', version);
    await mkdir(versionPath, { recursive: true });
    const fileName = path.join(versionPath, `${project.name}.insomnia.json`);
    const workspaces = await models.workspace.findByParentId(project._id);
    const docs = await Promise.all(workspaces.map(parentDoc => db.withDescendants(parentDoc)));
    const requests = docs.flat().filter(doc => isRequest(doc) || isGrpcRequest(doc) || isWebSocketRequest(doc));
    const stringifiedExport = await exportRequestsData(requests, true, 'json');
    await fs.writeFile(fileName, stringifiedExport);
    console.log('Exported project backup to:', fileName);
  }));
}
