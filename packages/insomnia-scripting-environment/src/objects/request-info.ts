/**
 * Represents the name of an event that can be triggered in the scripting environment.
 *
 * - `'prerequest'`: Event triggered before a request is sent.
 * - `'test'`: Event triggered during the testing phase.
 */
export type EventName = 'prerequest' | 'test';

/**
 * Represents options for creating a request information instance.
 *
 * @property eventName - The name of the event associated with the request, if any.
 * @property iteration - The current iteration number of the request, if applicable.
 * @property iterationCount - The total number of iterations for the request, if applicable.
 * @property requestName - The name of the request, if specified.
 * @property requestId - The unique identifier of the request, if specified.
 */
export interface RequestInfoOption {
  eventName?: EventName;
  iteration?: number;
  iterationCount?: number;
  requestName?: string;
  requestId?: string;
}

export class RequestInfo {
  /**
   * The name of the event associated with the request.
   * It could be 'prerequest` or 'test'.
   */
  public eventName: EventName;
  /**
   * The current iteration number of the request execution.
   * This value represents how many times the request has been executed
   * in a loop or sequence.
   */
  public iteration: number;
  /**
   * The number of iterations that have been executed.
   * This property tracks how many times a specific operation or process
   * has been repeated.
   */
  public iterationCount: number;
  /**
   * The name of the request.
   * This property holds the user-defined name for the request, which can be used
   * to identify or reference the request within the application.
   */
  public requestName: string;
  /**
   * The unique identifier for the request.
   */
  public requestId: string;

  /**
   * Constructs a new instance of the `RequestInfo` class.
   *
   * @param options - An object containing initialization options for the request information.
   * @param options.eventName - The name of the event associated with the request. Defaults to `'prerequest'`.
   * @param options.iteration - The current iteration number of the request. Defaults to `1`.
   * @param options.iterationCount - The total number of iterations for the request. Defaults to `1`.
   * @param options.requestName - The name of the request. Defaults to an empty string.
   * @param options.requestId - The unique identifier of the request. Defaults to an empty string.
   */
  constructor(options: RequestInfoOption) {
    this.eventName = options.eventName || 'prerequest';
    this.iteration = options.iteration || 1;
    this.iterationCount = options.iterationCount || 1;
    this.requestName = options.requestName || '';
    this.requestId = options.requestId || '';
  }

  /**
   * Converts the current instance of the object into a plain JavaScript object.
   *
   * @returns An object containing the following properties:
   * - `eventName`: The name of the event associated with the request.
   * - `iteration`: The current iteration number of the request.
   * - `iterationCount`: The total number of iterations for the request.
   * - `requestName`: The name of the request.
   * - `requestId`: The unique identifier of the request.
   */
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
