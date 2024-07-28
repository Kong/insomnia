import { describe, expect, it } from 'vitest';

import { type AuthOptions, fromPreRequestAuth, RequestAuth, toPreRequestAuth } from '../auth';
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
        } as AuthOptions;

        const authObj = new RequestAuth(basicAuthOptions);

        const basicAuthOptsFromAuth = varListToObject(authObj.parameters());
        expect(basicAuthOptsFromAuth).toEqual(basicAuthOptions.basic);

        const basicAuthOptions2 = {
            type: 'basic',
            basic: [
                { key: 'username', value: 'user2' },
                { key: 'password', value: 'pwd2' },
            ],
        } as AuthOptions;
        const bearerAuthOptions = {
            type: 'bearer',
            bearer: [
                { key: 'token', value: 'mytoken' },
            ],
        } as AuthOptions;

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

describe('test auth transforming', () => {
    it('transforming from script side to Insomnia and the reverse direction', () => {
        const basicAuth = {
            type: 'basic',
            useISO88591: true,
            disabled: false,
            username: 'uname',
            password: 'pwd',
        };
        const apikeyAuth = {
            type: 'apikey',
            disabled: false,
            key: 'key',
            value: 'value',
            addTo: 'addto',
        };
        const hawkAuth = {
            type: 'hawk',
            disabled: true,
            algorithm: 'sha256',
            id: 'id',
            key: 'key',
            ext: 'ext',
            validatePayload: true,
        };
        const oauth1Auth = {
            type: 'oauth1',
            disabled: true,
            signatureMethod: 'HMAC-SHA1',
            consumerKey: 'consumerKey',
            consumerSecret: 'consumerSecret',
            tokenKey: 'tokenKey',
            tokenSecret: 'tokenSecret',
            privateKey: 'privateKey',
            version: 'version',
            nonce: 'nonce',
            timestamp: 'timestamp',
            callback: 'callback',
            realm: 'realm',
            verifier: 'verifier',
            includeBodyHash: true,
        };
        const digestAuth = {
            type: 'digest',
            disabled: true,
            username: 'username',
            password: 'password',
        };
        const digestNtlm = {
            type: 'ntlm',
            disabled: true,
            username: 'username',
            password: 'password',
        };
        const bearerAuth = {
            type: 'bearer',
            disabled: true,
            token: 'token',
            prefix: 'prefix',
        };
        const awsv4Auth = {
            type: 'iam',
            disabled: true,
            accessKeyId: 'accessKeyId',
            secretAccessKey: 'secretAccessKey',
            sessionToken: 'sessionToken',
            region: 'region',
            service: 'service',
        };
        const asapAuth = {
            type: 'asap',
            disabled: true,
            issuer: 'issuer',
            subject: 'subject',
            audience: 'audience',
            additionalClaims: 'additionalClaims',
            keyId: 'keyId',
            privateKey: 'privateKey',
        };
        const noneAuth = {
            type: 'none',
            disabled: true,
        };
        const oauth2Auth = {
            type: 'oauth2',
            disabled: true,
            grantType: 'authorization_code',
            accessTokenUrl: 'accessTokenUrl',
            authorizationUrl: 'authorizationUrl',
            clientId: 'clientId',
            clientSecret: 'clientSecret',
            audience: 'audience',
            scope: 'scope',
            resource: 'resource',
            username: 'username',
            password: 'password',
            redirectUrl: 'redirectUrl',
            credentialsInBody: true,
            state: 'state',
            code: 'code',
            accessToken: 'accessToken',
            refreshToken: 'refreshToken',
            tokenPrefix: 'tokenPrefix',
            usePkce: true,
            pkceMethod: 'pkceMethod',
            responseType: 'id_token',
            origin: 'origin',
        };

        [
            basicAuth,
            apikeyAuth,
            hawkAuth,
            oauth1Auth,
            digestAuth,
            digestNtlm,
            bearerAuth,
            awsv4Auth,
            asapAuth,
            noneAuth,
            oauth2Auth,
        ].forEach(authMethod => {
            expect(fromPreRequestAuth(
                new RequestAuth(
                    toPreRequestAuth(authMethod)),
            )
            ).toEqual(authMethod);
        });
    });
});
