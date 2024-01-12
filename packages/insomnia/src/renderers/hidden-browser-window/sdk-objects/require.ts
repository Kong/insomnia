import * as uuid from 'uuid';

const builtinModules = new Map<string, any>([
    ['uuid', uuid],
]);

const nodeModules = new Map<string, any>([]);

export function require(moduleName: string) {
    if (builtinModules.has(moduleName)) {
        return builtinModules.get(moduleName);
    }

    if (nodeModules.has(moduleName)) {
        // invoke main.js
    }

    throw Error(`no module is found for "${moduleName}"`);
}
