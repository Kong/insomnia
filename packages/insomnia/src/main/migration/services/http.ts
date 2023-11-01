import { randomUUID } from 'crypto';
import type { LogFunctions } from 'electron-log';

import { insomniaFetch } from '../../insomniaFetch';
import type { IdentityService } from './identity';

interface ErrorResponse {
    error: string;
    message: string;
}

/**
 * This HttpClient class is a wrapper around insomniaFetch, created for the following purposes:
 *
 * - to enable logging specific to migration.
 * - to enable authenticated request to Insomnia API
 */
export class HttpClient {
    private _logger: LogFunctions;
    private _identity: IdentityService;

    constructor(logger: LogFunctions, identity: IdentityService) {
        this._logger = logger;
        this._identity = identity;
    }

    public get<T>(path: string): Promise<T | ErrorResponse> {
        const requestId = randomUUID();
        this._logger.info(`[migration][http][GET][${requestId}] making a http request:`, path);
        return insomniaFetch<T>({
            method: 'GET',
            path,
            requestId,
            sessionId: this._identity.sessionId,
        });
    }

    public post<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        const requestId = randomUUID();
        this._logger.info(`[migration][http][POST][${requestId}] making a http request:`, path);
        return insomniaFetch<T>({
            method: 'POST',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }

    public delete<T>(path: string): Promise<T | ErrorResponse> {
        const requestId = randomUUID();
        this._logger.info(`[migration][http][DELETE][${requestId}] making a http request:`, path);
        return insomniaFetch<T>({
            method: 'DELETE',
            path,
            sessionId: this._identity.sessionId,
        });
    }

    public patch<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        const requestId = randomUUID();
        this._logger.info(`[migration][http][PATCH][${requestId}] making a http request:`, path);
        return insomniaFetch<T>({
            method: 'PATCH',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }

    public put<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        const requestId = randomUUID();
        this._logger.info(`[migration][http][PUT][${requestId}] making a http request:`, path);
        return insomniaFetch<T>({
            method: 'PUT',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }
}
