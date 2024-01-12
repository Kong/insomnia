import { describe, expect, it } from '@jest/globals';

import { authOptionsToParams, RequestAuth } from '../auth';

describe('test sdk objects', () => {
  it('test RequestAuth methods', () => {
    expect(RequestAuth.isValidType('noauth')).toBeTruthy();

    const basicAuthOptions = {
      id: '',
      password: 'abc',
      username: 'tom',
    };
    // console.log(authOptionsToParams, RequestAuth);

    const authObj = new RequestAuth({
      type: 'basic',
      basic: authOptionsToParams(basicAuthOptions),
    });

    const optArray = authObj.parameters()?.map(
      optVar => ({
        type: 'any',
        key: optVar.key,
        value: optVar.value,
      }),
      {}
    );
    expect(optArray).toEqual(authOptionsToParams(basicAuthOptions));

    // const basicAuthOptions2 = {
    //   id: '',
    //   password: 'def',
    //   username: 'tim',
    // };
    // const bearerAuthOptions = {
    //   token: 'my_token',
    //   id: '',
    // };

    // authObj.update(basicAuthOptions2);
    // expect(authObj.parameters()).toEqual(basicAuthOptions2);

    // authObj.use('bearer', bearerAuthOptions);
    // expect(authObj.parameters()).toEqual(bearerAuthOptions);

    // authObj.clear('bearer');
    // expect(authObj.parameters()).toBeUndefined();
  });
});
