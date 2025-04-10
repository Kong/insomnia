export function checkIfUrlIncludesTag(url: string): boolean {
    return /{%/.test(`${url}`) ||
        /%}/.test(`${url}`) ||
        /{{/.test(`${url}`) ||
        /}}/.test(`${url}`);
}
