import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { McpResponse, Response, RunnerTestResult, SocketIOResponse, WebSocketResponse } from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { removeAllResponseHistory } from './response-operations';

const writeFile = (dir: string, name: string) => {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, 'confidential');
  return filePath;
};

describe('removeAllResponseHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes every response type and runner result, unlinks their files and leaves other models alone', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-all-response-history-'));
    const workspace = await services.workspace.create({ name: 'Workspace' });
    const request = await services.request.create({ name: 'Request', parentId: workspace._id });

    const httpResponse = await db.docCreate<Response>(models.response.type, {
      parentId: request._id,
      bodyPath: writeFile(dir, 'body'),
      timelinePath: writeFile(dir, 'timeline'),
    });
    const webSocketResponse = await db.docCreate<WebSocketResponse>(models.webSocketResponse.type, {
      parentId: 'ws-req_1',
      eventLogPath: writeFile(dir, 'ws-events'),
      timelinePath: writeFile(dir, 'ws-timeline'),
    });
    const socketIOResponse = await db.docCreate<SocketIOResponse>(models.socketIOResponse.type, {
      parentId: 'sio-req_1',
      eventLogPath: writeFile(dir, 'sio-events'),
      timelinePath: writeFile(dir, 'sio-timeline'),
    });
    const runnerTestResult = await db.docCreate<RunnerTestResult>(models.runnerTestResult.type, {
      parentId: workspace._id,
      source: 'runner',
      iterations: 1,
      iterationResults: [],
      responsesInfo: [],
    });
    const mcpResponse = await db.docCreate<McpResponse>(models.mcpResponse.type, {
      parentId: 'mcp-req_1',
      eventLogPath: writeFile(dir, 'mcp-events'),
      timelinePath: writeFile(dir, 'mcp-timeline'),
    });

    expect(await db.count(models.runnerTestResult.type, { _id: runnerTestResult._id })).toBe(1);

    await removeAllResponseHistory();

    expect(await db.count(models.response.type)).toBe(0);
    expect(await db.count(models.webSocketResponse.type)).toBe(0);
    expect(await db.count(models.socketIOResponse.type)).toBe(0);
    expect(await db.count(models.mcpResponse.type)).toBe(0);
    expect(await db.count(models.runnerTestResult.type, { _id: runnerTestResult._id })).toBe(0);

    for (const filePath of [
      httpResponse.bodyPath,
      httpResponse.timelinePath,
      webSocketResponse.eventLogPath,
      webSocketResponse.timelinePath,
      socketIOResponse.eventLogPath,
      socketIOResponse.timelinePath,
      mcpResponse.eventLogPath,
      mcpResponse.timelinePath,
    ]) {
      expect(fs.existsSync(filePath)).toBe(false);
    }

    // The requests the responses belonged to must survive - this clears history, not data.
    expect(await db.count(models.request.type, { _id: request._id })).toBe(1);
    expect(await db.count(models.workspace.type, { _id: workspace._id })).toBe(1);
  });

  it('does not throw when the response files are already gone', async () => {
    await db.docCreate<Response>(models.response.type, {
      parentId: 'req_2',
      bodyPath: path.join(os.tmpdir(), 'does-not-exist-body'),
      timelinePath: path.join(os.tmpdir(), 'does-not-exist-timeline'),
    });

    await expect(removeAllResponseHistory()).resolves.toBeUndefined();
    expect(await db.count(models.response.type)).toBe(0);
  });

  it('surfaces an unlink failure that is not a missing file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remove-all-response-history-'));
    await db.docCreate<Response>(models.response.type, {
      parentId: 'req_3',
      bodyPath: writeFile(dir, 'locked-body'),
      timelinePath: writeFile(dir, 'locked-timeline'),
    });

    const permissionError: NodeJS.ErrnoException = new Error('EPERM: operation not permitted');
    permissionError.code = 'EPERM';
    vi.spyOn(fs.promises, 'unlink').mockRejectedValue(permissionError);

    // A file left behind still holds the confidential body, so the caller must hear about it
    // instead of being told the history was cleared.
    await expect(removeAllResponseHistory()).rejects.toThrow('EPERM');
  });
});
