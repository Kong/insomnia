export interface ExecutionOption {
  location: string[];
  skipRequest?: boolean;
  nextRequestIdOrName?: string;
}

export class Execution {
  private _skipRequest: boolean;
  private _nextRequestIdOrName: string;
  public location: string[];

  constructor(options: ExecutionOption) {
    const { location, skipRequest = false, nextRequestIdOrName = '' } = options;
    if (Array.isArray(location)) {
      // mapping postman usage of location refer: https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-api-reference/#using-variables-in-scripts
      this.location = new Proxy([...location], {
        get: (target, prop, receiver) => {
          if (prop === 'current') {
            return target.length > 0 ? target[target.length - 1] : '';
          };
          return Reflect.get(target, prop, receiver);
        },
      });
      this._skipRequest = skipRequest;
      this._nextRequestIdOrName = nextRequestIdOrName;
    } else {
      throw new Error('Location input must be array of string');
    }
  };

  skipRequest = () => {
    this._skipRequest = true;
  };

  setNextRequest = (requestIdOrName: string) => {
    this._nextRequestIdOrName = requestIdOrName;
  };

  toObject = () => {
    return {
      location: Array.from(this.location),
      skipRequest: this._skipRequest,
      nextRequestIdOrName: this._nextRequestIdOrName,
    };
  };
};
