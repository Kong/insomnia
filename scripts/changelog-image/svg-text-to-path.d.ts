declare module 'svg-text-to-path' {

  export function getSvgElement(string: string): SVGSVGElement;

  export function  replaceAllInString(string: string, options: { [key: string]: {} }): string;
}
