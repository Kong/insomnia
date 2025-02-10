import type { queueAsPromised } from 'fastq';
import * as fastq from 'fastq';
import type { RequestContext, RequestTestResult } from 'insomnia-sdk';

import type { ClientCertificate } from '../models/client-certificate';
import type { CookieJar } from '../models/cookie-jar';
import type { Environment, UserUploadEnvironment } from '../models/environment';
import type { Request } from '../models/request';
import type { Settings } from '../models/settings';
import { cancellableExecution } from './cancellation';

export interface ExecuteScriptContext {
    request: Request;
    environment: {
        id: string;
        name: string;
        data: object;
    };
    baseEnvironment: {
        id: string;
        name: string;
        data: object;
    };
    clientCertificates: ClientCertificate[];
    settings: Settings;
    globals?: object;
    cookieJar: CookieJar;
    requestTestResults?: RequestTestResult[];
};

export interface TransformedExecuteScriptContext {
    error?: string;
    request: Request;
    environment: Environment;
    baseEnvironment: Environment;
    clientCertificates: ClientCertificate[];
    settings: Settings;
    globals?: Environment;
    cookieJar: CookieJar;
    requestTestResults?: RequestTestResult[];
    userUploadEnvironment?: UserUploadEnvironment;
    parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}

interface Task {
    script: string;
    context: RequestContext;
};

const q: queueAsPromised<Task> = fastq.promise(asyncWorker, 1);

async function asyncWorker(arg: Task): Promise<any> {
    const timeoutValue = arg.context.settings.timeout || 30000;
    const timeoutPromise = new Promise<{ error: string }>(resolve => setTimeout(resolve, timeoutValue, { error: `Executing script timeout: ${timeoutValue}` }));
    const executionPromise = Promise.race([window.main.hiddenBrowserWindow.runScript({ script: arg.script, context: arg.context }), timeoutPromise]);
    const result = await cancellableExecution({ id: arg.context.request._id, fn: executionPromise });
    return result;
}

export const runScriptConcurrently = async (options: { script: string; context: RequestContext }): Promise<RequestContext | { error: string }> => {
    return await q.push(options);
};
