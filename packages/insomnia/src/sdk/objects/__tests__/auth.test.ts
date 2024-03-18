import { describe, expect, it } from '@jest/globals';

import { RequestAuth } from '../auth';
import { Variable, VariableList } from '../variables';

const varListToObject = (obj: VariableList<Variable> | undefined) => {
    if (!obj) {
        return undefined;
    }

    return obj.map(
        (optVar: Variable) => ({
            // type: 'any', // TODO: fix type
            key: optVar.key,
            value: optVar.value,
        }),
        {}
    );
};

describe('test sdk objects', () => {
    it('test RequestAuth methods', () => {
        expect(RequestAuth.isValidType('noauth')).toBeTruthy();

        const basicAuthOptions = {
            type: 'basic',
            basic: [
                { key: 'username', value: 'user1' },
                { key: 'password', value: 'pwd1' },
            ],
        };

        const authObj = new RequestAuth(basicAuthOptions);

        const basicAuthOptsFromAuth = varListToObject(authObj.parameters());
        expect(basicAuthOptsFromAuth).toEqual(basicAuthOptions.basic);

        const basicAuthOptions2 = {
            type: 'basic',
            basic: [
                { key: 'username', value: 'user2' },
                { key: 'password', value: 'pwd2' },
            ],
        };
        const bearerAuthOptions = {
            type: 'bearer',
            bearer: [
                { key: 'token', value: 'mytoken' },
            ],
        };

        authObj.update(basicAuthOptions2);
        const basicAuthOpt2FromAuth = varListToObject(authObj.parameters());
        expect(basicAuthOpt2FromAuth).toEqual(basicAuthOptions2.basic);

        authObj.use('bearer', bearerAuthOptions);
        const beareerAuthOptFromAuth = varListToObject(authObj.parameters());
        expect(beareerAuthOptFromAuth).toEqual(bearerAuthOptions.bearer);

        authObj.clear('bearer');
        expect(authObj.parameters()).toBeUndefined();
    });
});
