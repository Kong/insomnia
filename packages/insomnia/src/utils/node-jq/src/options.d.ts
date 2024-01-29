import * as Joi from 'joi';

export declare const optionsSchema: Joi.SchemaLike;
export declare const preSpawnSchema: Joi.SchemaLike;
export declare const spawnSchema: Joi.SchemaLike;
export declare function parseOptions(options: PartialOptions, filter: string, json: any): any;
export declare const optionDefaults: IOptions;
interface IOptions {
    color: boolean;
    input: string;
    locations: string[];
    output: string;
    raw: boolean;
    slurp: boolean;
    sort: boolean;
}
export type PartialOptions = Partial<IOptions>;
