import type { LogFunctions } from 'electron-log';

import { insomniaFetch } from '../../insomniaFetch';

interface ErrorResponse {
    error: string;
    message: string;
}
export class HttpClient {
    private _sessionId: string | null = null;
    private _logger: LogFunctions;
    constructor(logger: LogFunctions) {
        this._logger = logger;
    }

    public setAuthentication(sessionId: string): void {
        this._logger.info('[migration] setting authentication for http client');
        this._sessionId = sessionId;
    }

    public get<T>(path: string): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'GET',
            path,
            sessionId: this._sessionId,
        });
    }

    public post<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'POST',
            path,
            data,
            sessionId: this._sessionId,
        });
    }

    public delete<T>(path: string): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'DELETE',
            path,
            sessionId: this._sessionId,
        });
    }

    public patch<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'DELETE',
            path,
            data,
            sessionId: this._sessionId,
        });
    }

    public put<T, D>(path: string, data: D): Promise<T | ErrorResponse> {
        this._logger.info('[migration] making a network call:', path);
        return insomniaFetch<T>({
            method: 'PUT',
            path,
            data,
            sessionId: this._sessionId,
        });
    }
}
