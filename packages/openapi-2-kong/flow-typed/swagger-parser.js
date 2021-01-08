// @flow

declare module 'swagger-parser' {
  declare class SwaggerParser {
    validate(api: string): Promise;
    validate(api: string, options: Object): Promise;
    validate(baseUrl: string, api: string, options: Object): Promise;

    dereference(api: string): Promise;
    dereference(api: string, options: Object): Promise;
    dereference(baseUrl: string, api: string, options: Object): Promise;

    static validate(api: string): Promise;
    static validate(api: string, options: Object): Promise;
    static validate(baseUrl: string, api: string, options: Object): Promise;
  
    static dereference(api: string): Promise;
    static dereference(api: string, options: Object): Promise;
    static dereference(baseUrl: string, api: string, options: Object): Promise;
  }

  declare export default typeof SwaggerParser
}
