// @flow

export interface BaseDriver {
  constructor(config: { [string]: any }): void;

  hasItem(key: string): Promise<boolean>;

  setItem(key: string, value: Buffer): Promise<void>;

  getItem(key: string): Promise<Buffer | null>;

  removeItem(key: string): Promise<void>;

  keys(prefix: string): Promise<Array<string>>;

  clear(): Promise<void>;
}
