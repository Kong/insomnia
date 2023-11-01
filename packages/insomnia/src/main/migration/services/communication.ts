import { BrowserWindow } from 'electron';
import type { Subscription } from 'rxjs';
import { delayWhen, interval, Subject } from 'rxjs';

interface CommunicationMessage {
    channel: string;
    data: unknown;
}

const DELAY_TIME = 500;
// TODO: if this is used else where, should be singleton
export class CommunicationService {
    private _receiver: BrowserWindow;
    private _queueOperation: Subscription | null = null;
    private _onMessage$ = new Subject<CommunicationMessage>();

    constructor(receiver: BrowserWindow) {
        this._receiver = receiver;
    }

    public broadcast(): void {
        this._queueOperation = this._onMessage$
            // setting a timer for each message queue
            .pipe(delayWhen((_, index) => interval(index * DELAY_TIME)))
            .subscribe(message => {
                this._receiver.webContents.send(message.channel, message.data);
            });
    }

    public publish<T>(channel: string, data: T) {
        this._onMessage$.next({ channel, data });
    }

    public unsubscribe(): void {
        this._queueOperation?.unsubscribe();
    }
}
