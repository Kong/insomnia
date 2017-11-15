import {globalBeforeEach} from '../../__jest__/before-each';
import * as models from '../../models/index';
import {initModel} from '../../models/index';
import {extendRequest} from '../parent-requests';
import {AUTH_BASIC, AUTH_NONE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED} from '../../common/constants';

describe('extendRequest()', () => {
  beforeEach(globalBeforeEach);

  it('Fails to extend null child', () => {
    expect(() => extendRequest({}, null)).toThrowError('Cannot extend empty child request');
  });

  testInheritance('null parent returns child',
    null,
    {url: 'https://child.insomnia.rest'},
    {url: 'https://child.insomnia.rest'}
  );

  testInheritance('child keeps it\'s URL',
    {url: 'https://insomnia.rest'},
    {url: 'https://child.insomnia.rest'},
    {url: 'https://child.insomnia.rest'}
  );

  testInheritance('inherits URL when it doesn\'t have one',
    {url: 'https://insomnia.rest'},
    {url: ''},
    {url: 'https://insomnia.rest'}
  );

  testInheritance('inherits URL when it doesn\'t have one',
    {url: 'https://insomnia.rest'},
    {url: ''},
    {url: 'https://insomnia.rest'}
  );

  testInheritance('child inherits full body when is not set',
    {body: {mimeType: 'text/plain', text: 'Hello World!'}},
    {body: {}},
    {body: {mimeType: 'text/plain', text: 'Hello World!'}},
  );

  testInheritance('child keeps full body when is set',
    {body: {mimeType: 'text/plain', text: 'Hello World!'}},
    {body: {mimeType: 'text/plain', text: 'Hello from child!'}},
    {body: {mimeType: 'text/plain', text: 'Hello from child!'}},
  );

  testInheritance('child inherits params when urlencoded', {
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [{name: 'parent', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [{name: 'child', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {name: 'parent', value: 'true'},
        {name: 'child', value: 'true'}
      ]
    }
  });

  testInheritance('child inherits params when multipart', {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [{name: 'parent', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [{name: 'child', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [
        {name: 'parent', value: 'true'},
        {name: 'child', value: 'true'}
      ]
    }
  });

  testInheritance('child doesn\'t inherit when different form types', {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [{name: 'parent', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [{name: 'child', value: 'true'}]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [{name: 'child', value: 'true'}]
    }
  });

  testInheritance('child overwrites body params', {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [
        {name: 'foo', value: 'parent'},
        {name: '', value: ''},
        {name: 'disabled_child', value: 'parent'},
        {name: 'disabled_both', value: 'parent', disabled: true},
        {name: 'disabled_only_parent', value: 'child', disabled: true}
      ]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [
        {name: 'foo', value: 'child'},
        {name: 'disabled_child', value: 'child', disabled: true},
        {name: 'disabled_both', value: 'child', disabled: true}
      ]
    }
  }, {
    body: {
      mimeType: CONTENT_TYPE_FORM_DATA,
      params: [
        {name: 'disabled_child', value: 'parent'},
        {name: 'foo', value: 'child'},
        {name: 'disabled_child', value: 'child', disabled: true},
        {name: 'disabled_both', value: 'child', disabled: true}
      ]
    }
  });

  testInheritance('child overwrites headers', {
    headers: [
      {name: 'foo', value: 'parent'},
      {name: '', value: ''},
      {name: 'disabled_child', value: 'parent'},
      {name: 'disabled_both', value: 'parent', disabled: true},
      {name: 'disabled_only_parent', value: 'child', disabled: true}
    ]
  }, {
    headers: [
      {name: 'foo', value: 'child'},
      {name: 'disabled_child', value: 'child', disabled: true},
      {name: 'disabled_both', value: 'child', disabled: true}
    ]
  }, {
    headers: [
      {name: 'disabled_child', value: 'parent'},
      {name: 'foo', value: 'child'},
      {name: 'disabled_child', value: 'child', disabled: true},
      {name: 'disabled_both', value: 'child', disabled: true}
    ]
  });

  testInheritance('child overwrites parameters', {
    parameters: [
      {name: 'foo', value: 'parent'},
      {name: '', value: ''},
      {name: 'disabled_child', value: 'parent'},
      {name: 'disabled_both', value: 'parent', disabled: true},
      {name: 'disabled_only_parent', value: 'child', disabled: true}
    ]
  }, {
    parameters: [
      {name: 'foo', value: 'child'},
      {name: 'disabled_child', value: 'child', disabled: true},
      {name: 'disabled_both', value: 'child', disabled: true}
    ]
  }, {
    parameters: [
      {name: 'disabled_child', value: 'parent'},
      {name: 'foo', value: 'child'},
      {name: 'disabled_child', value: 'child', disabled: true},
      {name: 'disabled_both', value: 'child', disabled: true}
    ]
  });

  testInheritance('parent overrides unset auth',
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}},
    {authentication: {}},
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}}
  );

  testInheritance('parent overrides NONE auth',
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}},
    {authentication: {type: AUTH_NONE, foo: 'bar'}},
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}}
  );

  testInheritance('parent skips auth',
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}},
    {authentication: {type: AUTH_BASIC, username: 'child', password: 'child'}},
    {authentication: {type: AUTH_BASIC, username: 'child', password: 'child'}}
  );

  testInheritance('parent skips disabled inheritance setting',
    {authentication: {type: AUTH_BASIC, username: 'user', password: 'pass'}},
    {authentication: {disableInheritance: true}},
    {authentication: {disableInheritance: true}}
  );

  testInheritance('child does not inherit NONE auth',
    {authentication: {type: AUTH_NONE}},
    {authentication: {}},
    {authentication: {}}
  );
});

function testInheritance (name, parentSub, childSub, attrs) {
  it(name, async () => {
    const parent = parentSub ? await dummyReq('parent', parentSub) : null;
    const child = childSub ? await dummyReq('child', childSub) : null;
    const result = extendRequest(parent, child);
    for (const attr of Object.keys(attrs)) {
      expect(result[attr]).toEqual(attrs[attr]);
    }
  });
}

async function dummyReq (id, ...patches) {
  return await initModel(models.request.type, {
    _id: id,
    type: 'Request',
    created: 123,
    modified: 456,
    metaSortKey: 789
  }, ...patches);
}
