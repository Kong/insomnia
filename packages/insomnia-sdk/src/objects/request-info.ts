export type EventName = 'prerequest' | 'test';

export interface RequestInfoOption {
    eventName?: EventName;
    iteration?: number;
    iterationCount?: number;
    requestName?: string;
    requestId?: string;
};

export class RequestInfo {
    public eventName: EventName;
    public iteration: number;
    public iterationCount: number;
    public requestName: string;
    public requestId: string;

    constructor(options: RequestInfoOption) {
        this.eventName = options.eventName || 'prerequest';
        this.iteration = options.iteration || 1;
        this.iterationCount = options.iterationCount || 1;
        this.requestName = options.requestName || '';
        this.requestId = options.requestId || '';
    }

    toObject = () => {
        return {
            eventName: this.eventName,
            iteration: this.iteration,
            iterationCount: this.iterationCount,
            requestName: this.requestName,
            requestId: this.requestId,
        };
    };
}
