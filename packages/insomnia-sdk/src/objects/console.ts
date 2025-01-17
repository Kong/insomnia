type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

export interface Row {
    value: string;
    name: string;
    timestamp: number;
}

class Console {
    rows: Row[] = [];

    constructor() { }

    // TODO: support replacing substitution
    printLog = (rows: Row[], level: LogLevel, ...values: any) => {
        try {
            const content = values.map(
                (value: any) => {
                    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
                }
            ).join(' ');

            const row = {
                value: `${level}: ${content}`,
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

let builtInConsole = new Console();
export function getExistingConsole() {
    return builtInConsole;
}
export function getNewConsole() {
    builtInConsole = new Console();
    return builtInConsole;
}
