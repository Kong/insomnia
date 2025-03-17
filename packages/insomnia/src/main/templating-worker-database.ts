import { database as db } from '../common/database';
import * as models from '../models';
import type { Request as DBRequest } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Workspace } from '../models/workspace';
import { fetchRequestData, sendCurlAndWriteTimeline, tryToInterpolateRequest } from '../network/network';

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
    if (url.host === 'cookieJar.getOrCreateForWorkspace'.toLowerCase()) {
        result = await models.cookieJar.getOrCreateForParentId(body.id);
    }
    if (url.host === 'response.getLatestForRequestId'.toLowerCase()) {
        result = await models.response.getLatestForRequest(body.requestId, body.environmentId);
    }
    if (url.host === 'response.getBodyBuffer'.toLowerCase()) {
        result = await models.response.getBodyBuffer(body.response, body.readFailureValue);
    }
    if (url.host === 'network.sendRequest'.toLowerCase()) {
        const { request,
            environment,
            settings,
            clientCertificates,
            caCert,
            timelinePath,
            responseId,
        } = await fetchRequestData(body.request._id);

        const renderResult = await tryToInterpolateRequest({ request, environment: environment._id, purpose: 'send', extraInfo: body.extraInfo });
        const response = await sendCurlAndWriteTimeline(
            renderResult.request,
            clientCertificates,
            caCert,
            settings,
            timelinePath,
            responseId
        );
        result = await models.response.create({ ...response, bodyCompression: null }, settings.maxHistoryResponses);
    }

    return new Response(JSON.stringify(result));
};
