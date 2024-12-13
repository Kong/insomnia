import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { project, request, requestGroup, workspace } from '../../models';
import * as importUtil from '../import';

/*
@vitest-environment jsdom
*/

describe('isApiSpecImport()', () => {
  it.each(['swagger2', 'openapi3'])(
    'should return true if spec id is %o',
    (id: string) => {
      expect(importUtil.isApiSpecImport({ id })).toBe(true);
    }
  );

  it('should return false if spec id is not valid', () => {
    const id = 'invalid-id';
    expect(importUtil.isApiSpecImport({ id })).toBe(false);
  });
});

describe('isInsomniaV4Import()', () => {
  it.each(['insomnia-4'])('should return true if spec id is %o', (id: string) => {
    expect(importUtil.isInsomniaV4Import({ id })).toBe(true);
  });

  it('should return false if spec id is not valid', () => {
    const id = 'invalid-id';
    expect(importUtil.isInsomniaV4Import({ id })).toBe(false);
  });
});

describe('importRaw()', () => {
  it('should import a curl request to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();

    const scanResult = await importUtil.scanResources([content]);

    expect(scanResult[0].type?.id).toBe('curl');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(
      projectToImportTo._id
    );
    const curlRequests = await request.findByParentId(projectWorkspaces[0]._id);

    expect(workspacesCount).toBe(1);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a curl request to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources([content]);

    expect(scanResult[0].type?.id).toBe('curl');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const curlRequests = await request.findByParentId(existingWorkspace._id);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a postman collection to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();
    const projectToImportTo = await project.create();
    const scanResult = await importUtil.scanResources([content]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const projectWorkspaces = await workspace.findByParentId(
      projectToImportTo._id
    );

    const requestGroups = await requestGroup.findByParentId(projectWorkspaces[0]._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import a postman collection to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources([content]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const requestGroups = await requestGroup.findByParentId(existingWorkspace._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import an openapi collection to an existing workspace with scope design', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const scanResult = await importUtil.scanResources([content]);

    expect(scanResult[0].type?.id).toBe('openapi3');
    expect(scanResult[0].errors.length).toBe(0);
  });

});
