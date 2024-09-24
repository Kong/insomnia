type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

export interface Row {
    value: string;
    name: string;
    timestamp: number;
}

export class Console {
    rows: Row[] = [];

    constructor() { }

    // TODO: support replacing substitution
    printLog = (rows: Row[], level: LogLevel, ...values: any) => {
        try {
            const row = {
                value: `${level}: ` + values.map((a: any) => JSON.stringify(a, null, 2)).join('\n'),
                name: 'Text',
                timestamp: Date.now(),
            };

            rows.push(row);
        } catch (e) {
            rows.push({
                value: 'error: ' + JSON.stringify(e, null, 2),
                name: 'Text',
                timestamp: Date.now(),
            });
        }
    };

    log = (...values: any[]) => {
        this.printLog(this.rows, 'log', ...values);
    };

    warn = (...values: any[]) => {
        this.printLog(this.rows, 'warn', ...values);
    };

    debug = (...values: any[]) => {
        this.printLog(this.rows, 'debug', ...values);
    };

    info = (...values: any[]) => {
        this.printLog(this.rows, 'info', ...values);
    };

    error = (...values: any[]) => {
        this.printLog(this.rows, 'error', ...values);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clear = (_level: LogLevel, _message?: any, ..._optionalParams: any[]) => {
        throw Error('currently "clear" is not supported for the timeline');
    };

    dumpLogs = () => {
        return this.rows
            .map(row => JSON.stringify(row) + '\n')
            .join('\n');
    };

    dumpLogsAsArray = () => {
        return this.rows
            .map(row => JSON.stringify(row) + '\n');
    };
}
