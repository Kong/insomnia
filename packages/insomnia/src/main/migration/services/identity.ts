import { LogFunctions } from 'electron-log';

export class IdentityService {
    private _logger: LogFunctions;
    private _currentSessionId: string | null = null;
    private _currentAccountId: string | null = null;

    public get accountId() {
        return this._currentAccountId;
    }

    public get sessionId() {
        return this._currentSessionId;
    }

    constructor(logger: LogFunctions) {
        this._logger = logger;
    }

    public setIdentity(sessionId: string, accountId: string): void {
        this._currentSessionId = sessionId;
        this._currentAccountId = accountId;
        this._logger.info('[migration][identity] setting the identity for user', accountId);
    }
}
