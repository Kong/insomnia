import path from 'node:path';

import * as contentDisposition from 'content-disposition';
import orderedJSON from 'json-order';
import { extension as mimeExtension } from 'mime-types';
import { v4 as uuidv4 } from 'uuid';

import { init as initClientCertificate } from '../../src/models/client-certificate';
import { CookieJar } from '../../src/models/cookie-jar';
import { transformToPreRequestAuth } from '../../src/renderers/hidden-browser-window/sdk-objects/send-req';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../common/constants';
import { getContentDispositionHeader } from '../common/misc';
import { RENDER_PURPOSE_SEND } from '../common/render';
import { RenderedRequest } from '../common/render';
import type { ResponseTimelineEntry } from '../main/network/libcurl-promise';
import { ResponsePatch } from '../main/network/libcurl-promise';
import * as models from '../models';
import { CaCertificate } from '../models/ca-certificate';
import { ClientCertificate } from '../models/client-certificate';
import { Environment } from '../models/environment';
import type { Request } from '../models/request';
import { Settings } from '../models/settings';
import { RawObject } from '../renderers/hidden-browser-window/inso-object';
import { writeToDownloadPath } from '../ui/routes/request';
import { getWindowMessageHandler } from '../ui/window-message-handlers';
import { invariant } from '../utils/invariant';
import { storeTimeline } from './network';
import { responseTransform, sendCurlAndWriteTimeline } from './network';
import { tryToInterpolateRequest, tryToTransformRequestWithPlugins } from './network';

interface PreRequestScriptMessage {
    insomnia: RawObject;
}

export class RequestSender {
    private request: Request;
    private shouldPromptForPathAfterResponse: boolean | undefined;
    private baseEnvironment: Environment;
    private environment: Environment;
    private settings: Settings;
    private clientCertificates: ClientCertificate[];
    private caCert: CaCertificate | null;
    private cookieJar: CookieJar | null;
    private preRequestScript: string;

    private timeline: ResponseTimelineEntry[];

    constructor(
        req: Request,
        shouldPromptForPathAfterResponse: boolean | undefined,
        baseEnvironment: Environment,
        environment: Environment,
        settings: Settings,
        clientCertificates: ClientCertificate[],
        caCert: CaCertificate | null,
        cookieJar: CookieJar | null,
        preRequestScript: string,
    ) {
        this.request = req;
        this.shouldPromptForPathAfterResponse = shouldPromptForPathAfterResponse;
        this.baseEnvironment = baseEnvironment;
        this.environment = environment;
        this.settings = settings;
        this.clientCertificates = clientCertificates;
        this.caCert = caCert;
        this.preRequestScript = preRequestScript;
        this.cookieJar = cookieJar;
        this.request.preRequestScript = ''; // avoid rendering error and the script is already saved

        this.timeline = [];
    }

    start = async () => {
        const insomniaObject: PreRequestScriptMessage = {
            insomnia: {
                globals: {}, // TODO:
                environment: this.environment.data,
                collectionVariables: this.baseEnvironment.data,
                iterationData: {}, // TODO:
                requestInfo: {}, // TODO:
            },
        };

        try {
            if (this.preRequestScript !== '') {
                const result = await this.runPreRequestScript(
                    insomniaObject,
                    this.preRequestScript,
                );
                if (!result?.context) {
                    console.error('no response returned');
                    return;
                }
                if (result.outputs) {
                    result.outputs.forEach(row => {
                        this.timeline.push({
                            value: `Pre-request-script(${row.level}): ${row.messages.join(' ')}`,
                            name: 'Text',
                            timestamp: Date.now(),
                        });
                    });
                }

                const rawObj = result.context as Record<string, any>;
                const envJsonMap = orderedJSON.parse(
                    JSON.stringify(rawObj.environment),
                    JSON_ORDER_PREFIX,
                    JSON_ORDER_SEPARATOR,
                );
                const baseEnvJsonMap = orderedJSON.parse(
                    JSON.stringify(rawObj.collectionVariables),
                    JSON_ORDER_PREFIX,
                    JSON_ORDER_SEPARATOR,
                );

                // map raw object to insomnia's environment hierarchy
                this.environment.data = rawObj.environment;
                this.environment.dataPropertyOrder = envJsonMap.map;
                this.baseEnvironment.data = rawObj.collectionVariables;
                this.baseEnvironment.dataPropertyOrder = baseEnvJsonMap.map;

                // apply updates to the request
                const updatedReq = rawObj.request;
                this.request.url = updatedReq.url;
                this.request.method = updatedReq.method;
                this.request.headers = updatedReq.header.map((header: { key: string; value: string; disabled: boolean }) => ({
                    name: header.key,
                    value: header.value,
                    disabled: header.disabled,
                }));
                this.request.body.text = updatedReq.body.raw;
                this.request.body.fileName = updatedReq.body.file;
                this.request.body.params = updatedReq.body.urlencoded?.map((param: { key: string; value: string }) => ({ name: param.key, value: param.value }));
                // TODO: other fields are not supported yet
                this.request.authentication = transformToPreRequestAuth(updatedReq.auth);
                this.settings.proxyEnabled = updatedReq.proxy != null && !updatedReq.disabled;
                const proxyUrl = updatedReq.proxy.host + updatedReq.proxy.port ? `:${updatedReq.proxy.port}` : '';
                this.settings.httpProxy = proxyUrl.startsWith('http') ? proxyUrl : '';
                this.settings.httpsProxy = proxyUrl.startsWith('https') ? proxyUrl : '';

                if (updatedReq.certificate) {
                    if (this.clientCertificates && this.clientCertificates.length > 0) {
                        this.clientCertificates[0] = {
                            ...this.clientCertificates[0],
                            key: updatedReq.certificate.key ? updatedReq.certificate.key.src : undefined,
                            cert: updatedReq.certificate.cert ? updatedReq.certificate.cert.src : undefined,
                            passphrase: updatedReq.certificate.passphrase,
                            pfx: updatedReq.certificate.pfx ? updatedReq.certificate.pfx.src : undefined,
                        };
                    } else {
                        const baseCertificate = {
                            ...initClientCertificate(),
                            // TODO: remove baseModelPart when it is not necessary for certs
                            _id: '',
                            type: '',
                            parentId: '',
                            modified: 0,
                            created: 0,
                            isPrivate: false,
                            name: '',

                            key: updatedReq.certificate.key ? updatedReq.certificate.key.src : undefined,
                            cert: updatedReq.certificate.cert ? updatedReq.certificate.cert.src : undefined,
                            passphrase: updatedReq.certificate.passphrase,
                            pfx: updatedReq.certificate.pfx ? updatedReq.certificate.pfx.src : undefined,
                        };
                        this.clientCertificates = [baseCertificate];
                    }
                }

                this.timeline.push({
                    value: 'Pre-request script execution done',
                    name: 'Text',
                    timestamp: Date.now(),
                });
            }

            const { renderedRequest, renderedResult } = await this.renderRequest(this.request);
            const responsePatch = await this.sendRequest(renderedRequest);
            await this.persistRequestAndResponse(renderedRequest, responsePatch, renderedResult);
        } catch (e) {
            if (!e.message) {
                console.error(`no message found in error: ${JSON.stringify(e)}`);
                e.message = 'unknown error';
            }

            this.timeline.push({
                value: `Failed to send request: ${e.message}`,
                name: 'Text',
                timestamp: Date.now(),
            });

            const timelinePath = await storeTimeline(this.timeline);

            const nonRespPatch = {
                parentId: this.request._id,
                timelinePath,
                statusCode: 0,
                statusMessage: 'Error',
            };

            const requestMeta = await models.requestMeta.getByParentId(this.request._id);
            if (!requestMeta) {
                console.error(`no request meta found for request: ${this.request._id}`);
                return;
            }
            const response = await models.response.create(nonRespPatch, this.settings.maxHistoryResponses);
            await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
        }
    };

    runPreRequestScript = async (context: object, code: string) => {
        const scriptRunId = uuidv4();
        const winMsgHandler = getWindowMessageHandler();
        return await winMsgHandler.runPreRequestScript(
            scriptRunId,
            code,
            context,
            this.request,
            this.settings,
            this.clientCertificates,
            this.cookieJar,
        );
    };

    renderRequest = async (req: Request) => {
        const renderedResult = await tryToInterpolateRequest(req, this.environment, RENDER_PURPOSE_SEND, undefined, this.baseEnvironment);
        const renderedRequest = await tryToTransformRequestWithPlugins(renderedResult);

        // TODO: remove this temporary hack to support GraphQL variables in the request body properly
        if (renderedRequest && renderedRequest.body?.text && renderedRequest.body?.mimeType === 'application/graphql') {
            try {
                const parsedBody = JSON.parse(renderedRequest.body.text);
                if (typeof parsedBody.variables === 'string') {
                    parsedBody.variables = JSON.parse(parsedBody.variables);
                    renderedRequest.body.text = JSON.stringify(parsedBody, null, 2);
                }
            } catch (e) {
                console.error('Failed to parse GraphQL variables', e);
            }
        }

        return { renderedRequest, renderedResult };
    };

    sendRequest = async (req: RenderedRequest) => {
        return await sendCurlAndWriteTimeline(
            req,
            this.clientCertificates,
            this.caCert,
            this.settings,
            this.timeline,
        );
    };

    persistRequestAndResponse = async (
        req: RenderedRequest,
        rawRespPatch: ResponsePatch,
        renderedResult: Record<string, any>,
    ) => {
        const requestMeta = await models.requestMeta.getByParentId(this.request._id);
        invariant(requestMeta, 'RequestMeta not found');

        const responsePatch = await responseTransform(rawRespPatch, this.environment._id, req, renderedResult.context);
        const is2XXWithBodyPath = responsePatch.statusCode &&
            responsePatch.statusCode >= 200 &&
            responsePatch.statusCode < 300 &&
            responsePatch.bodyPath;

        const shouldWriteToFile = this.shouldPromptForPathAfterResponse && is2XXWithBodyPath;
        if (!shouldWriteToFile) {
            const response = await models.response.create(responsePatch, this.settings.maxHistoryResponses);
            await models.requestMeta.update(requestMeta, { activeResponseId: response._id });
            // setLoading(false);
            return null;
        }

        if (requestMeta.downloadPath) {
            const header = getContentDispositionHeader(responsePatch.headers || []);
            const name = header
                ? contentDisposition.parse(header.value).parameters.filename
                : `${req.name.replace(/\s/g, '-').toLowerCase()}.${responsePatch.contentType && mimeExtension(responsePatch.contentType) || 'unknown'}`;
            return writeToDownloadPath(path.join(requestMeta.downloadPath, name), responsePatch, requestMeta, this.settings.maxHistoryResponses);
        } else {
            const defaultPath = window.localStorage.getItem('insomnia.sendAndDownloadLocation');
            const { filePath } = await window.dialog.showSaveDialog({
                title: 'Select Download Location',
                buttonLabel: 'Save',
                // NOTE: An error will be thrown if defaultPath is supplied but not a String
                ...(defaultPath ? { defaultPath } : {}),
            });
            if (!filePath) {
                // setLoading(false);
                return null;
            }

            window.localStorage.setItem('insomnia.sendAndDownloadLocation', filePath);
            return writeToDownloadPath(filePath, responsePatch, requestMeta, this.settings.maxHistoryResponses);
        }
    };
}
