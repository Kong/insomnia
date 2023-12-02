import { Property } from './object-base';

type AuthType = 'none' | 'apikey' | 'bearer' | 'jwt' | 'basic';

export class RequestAuth extends Property {
    private authType: AuthType;

    constructor(options: { type: string }, parent?: Property) {
        super();
        this.authType = options.type as AuthType;
        this._parent = parent;
    }

    // static isValidType(type: string) {
    //     return
    // }

    // clear(type) {

    // }

    // defined
    // describe(content, typeopt)
    // findInParents(property, customizeropt) → {*| undefined }
    // forEachParent(options, iterator)
    // meta() → {*}
    // parent() → {*| undefined }

    // undefined
    // parameters() → { VariableList }
    // toJSON()
    // update(options, typeopt)
    // use(type, options)
}
