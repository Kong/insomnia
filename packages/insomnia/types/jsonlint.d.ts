declare module 'jsonlint-mod-fixed' {

    interface ParseErrorHash {
        expected?: string[];
        line?: number;
        loc?: {
            first_column: number;
            first_line: number;
            last_column: number;
            last_line: number;
        };
        message?: string;
        text?: string;
        token?: string | null;
    }

    export function parse(input: string): string;
    export namespace parser {
        export function parseError(str: string, hash: ParseErrorHash): void;
    }

}
