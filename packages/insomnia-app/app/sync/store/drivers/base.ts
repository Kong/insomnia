export interface BaseDriver {
  hasItem(key: string): Promise<boolean>;
  setItem(key: string, value: Buffer): Promise<void>;
  getItem(key: string): Promise<Buffer | null>;
  removeItem(key: string): Promise<void>;
  keys(prefix: string, recursive: boolean): Promise<string[]>;
  clear(): Promise<void>;
}
