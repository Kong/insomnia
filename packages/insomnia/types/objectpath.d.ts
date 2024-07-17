declare module 'objectpath' {
    export function parse(str: string): string[];

    export function stringify(
        arr: string | (string | number)[],
        quote?: '"' | "'",
        forceQuote?: boolean
    ): string;

    export function normalize(
        data: string,
        quote?: '"' | "'",
        forceQuote?: boolean
    ): string;
}
