type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

export interface Row {
    level: LogLevel;
    messages: string[];
}

export class Console {
    private rows: Row[] = [];
    constructor() { }

    write = (level: LogLevel, message?: any, ...optionalParams: any[]) => {
        try {
            const params = optionalParams.map(param => JSON.stringify(param, null, 2));
            const row = {
                level,
                messages: [
                    JSON.stringify(message, null, 2),
                    ...params,
                ],
            };

            this.rows = [...this.rows, row];
        } catch (e) {
            this.rows = [
                ...this.rows,
                {
                    level: 'error',
                    messages: e.toString(),
                },
            ];
        }
    };

    log = (message?: any, ...optionalParams: any[]) => {
        this.write('log', message, ...optionalParams);
    };

    warn = (message?: any, ...optionalParams: any[]) => {
        this.write('warn', message, ...optionalParams);
    };

    debug = (message?: any, ...optionalParams: any[]) => {
        this.write('debug', message, ...optionalParams);
    };

    info = (message?: any, ...optionalParams: any[]) => {
        this.write('info', message, ...optionalParams);
    };

    error = (message?: any, ...optionalParams: any[]) => {
        this.write('error', message, ...optionalParams);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clear = (_level: LogLevel, _message?: any, ..._optionalParams: any[]) => {
        throw Error('currently "clear" is not supported for the timeline');
    };

    valueOf = () => {
        return this.rows;
    };
}
