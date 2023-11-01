import type { HttpClient } from './http';

export class IdentityService {
    private _currentSessionId: string | null = null;
    private _currentAccountId: string | null = null;
    private _http: HttpClient;

    public get accountId() {
        return this._currentAccountId;
    }

    public get sessionId() {
        return this._currentSessionId;
    }

    constructor(http: HttpClient) {
        this._http = http;
    }

    public setIdentity(sessionId: string, accountId: string): void {
        this._currentSessionId = sessionId;
        this._currentAccountId = accountId;
        this._http.setAuthentication(sessionId);
    }
}
