import { AppConstructorOptions } from 'spectron';

export interface Config {
  packagePath: string;
  buildPath: string;
  env?: AppConstructorOptions['env'];
}
