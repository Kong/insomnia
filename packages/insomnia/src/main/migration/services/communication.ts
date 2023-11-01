import { BrowserWindow } from 'electron';
import { LogFunctions } from 'electron-log';
import type { Subscription } from 'rxjs';
import { delayWhen, interval, Subject } from 'rxjs';

interface CommunicationMessage {
    channel: string;
    data: unknown;
}

const DELAY_INTERVAL = 500;
// TODO: if this is used else where, should be singleton
export class CommunicationService {
    private _receiver: BrowserWindow;
    private _logger: LogFunctions;

    /**
     * This is the execution of observable in queue.
     * In this context, we are getting message from observable, and its execution (subscription) is
     * delayed by the DELAY_INTERVAL value
     * */
    private _queueMessage: Subscription | null = null;
    private _onMessage$ = new Subject<CommunicationMessage>();

    constructor(logger: LogFunctions, receiver: BrowserWindow) {
        this._logger = logger;
        this._receiver = receiver;
    }

    public broadcast(): void {
        this._logger.info('[migration][communication] broadcasting started');
        this._queueMessage = this._onMessage$
            // setting a timer for each message queue
            .pipe(delayWhen((_, index) => interval(index * DELAY_INTERVAL)))
            .subscribe(message => {
                this._receiver.webContents.send(message.channel, message.data);
            });
    }

    public publish<T>(channel: string, data: T) {
        this._onMessage$.next({ channel, data });
    }

    public stop(): void {
        this._logger.info('[migration][communication] broadcasting stopping');
        this._queueMessage?.unsubscribe();
        this._logger.info('[migration][communication] broadcasting stopped');
    }
}
