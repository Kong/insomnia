import { database as db } from '../common/database';
import * as models from '../models';
import type { Request as DBRequest } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Workspace } from '../models/workspace';
import { cloudServiceProviderAuthentication, getSecret } from './ipc/cloud-service-integration/cloud-service';

export const resolveDbByKey = async (request: Request) => {
    const url = new URL(request.url);
    let result;
    const body = await request.json();
    if (url.host === 'request.getById'.toLowerCase()) {
        result = await models.request.getById(body.id);
    }
    if (url.host === 'request.getAncestors'.toLowerCase()) {
        result = await db.withAncestors<DBRequest | RequestGroup | Workspace>(body.request, body.types);
    }
    if (url.host === 'workspace.getById'.toLowerCase()) {
        result = await models.workspace.getById(body.id);
    }
    if (url.host === 'oAuth2Token.getByRequestId'.toLowerCase()) {
        result = await models.oAuth2Token.getByParentId(body.parentId);
    }
    if (url.host === 'cloudCredential.getById'.toLowerCase()) {
        result = await models.cloudCredential.getById(body.id);
    }
    if (url.host === 'cloudCredential.update'.toLowerCase()) {
        result = await models.cloudCredential.update(body.originCredential, body.patch);
    }
    if (url.host === 'cloudService.authenticate'.toLowerCase()) {
        result = await cloudServiceProviderAuthentication(body.options);
    }
    if (url.host === 'cloudService.getSecret'.toLowerCase()) {
        result = await getSecret(body.options);
    }
    if (url.host === 'cookieJar.getOrCreateForWorkspace'.toLowerCase()) {
        result = await models.cookieJar.getOrCreateForParentId(body.id);
    }
    if (url.host === 'response.getLatestForRequestId'.toLowerCase()) {
        result = await models.response.getLatestForRequest(body.requestId, body.environmentId);
    }
    if (url.host === 'response.getBodyBuffer'.toLowerCase()) {
        result = await models.response.getBodyBuffer(body.response, body.readFailureValue);
    }

    return new Response(JSON.stringify(result));
};
