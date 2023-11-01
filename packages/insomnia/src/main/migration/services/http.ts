import type { LogFunctions } from 'electron-log';

import { insomniaFetch } from '../../insomniaFetch';
import type { IdentityService } from './identity';

interface ErrorResponse {
    error: string;
    message: string;
}
export class HttpClient {
    private _logger: LogFunctions;
    private _identity: IdentityService;

    constructor(logger: LogFunctions, identity: IdentityService) {
        this._logger = logger;
        this._identity = identity;
    }

    public get<T>(path: string): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'GET',
            path,
            sessionId: this._identity.sessionId,
        });
    }

    public post<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'POST',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }

    public delete<T>(path: string): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'DELETE',
            path,
            sessionId: this._identity.sessionId,
        });
    }

    public patch<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'DELETE',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }

    public put<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'PUT',
            path,
            data,
            sessionId: this._identity.sessionId,
        });
    }
}
