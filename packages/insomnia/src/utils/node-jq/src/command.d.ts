import { PartialOptions } from './options';

export const FILTER_UNDEFINED_ERROR =
    'node-jq: invalid filter argument supplied: "undefined"';
export const INPUT_JSON_UNDEFINED_ERROR =
    'node-jq: invalid json object argument supplied: "undefined"';
export const INPUT_STRING_ERROR =
    'node-jq: invalid json string argument supplied';

interface ICommand {
    command: string;
    args: string[];
    stdin: string;
}
export function commandFactory(filter: string, json: any, options?: PartialOptions, jqPath?: string): ICommand;
