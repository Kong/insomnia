import * as renderUtils from '../render';
import * as models from '../../models';

jest.mock('electron');

describe('render()', () => {
  it('renders hello world', async () => {
    const rendered = await renderUtils.render('Hello {{ msg }}!', {msg: 'World'});
    expect(rendered).toBe('Hello World!');
  });

  it('renders custom tag: uuid', async () => {
    const rendered = await renderUtils.render('Hello {% uuid %}!');
    expect(rendered).toMatch(/Hello [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}!/);
  });

  it('renders custom tag: timestamp', async () => {
    const rendered = await renderUtils.render('Hello {% timestamp %}!');
    expect(rendered).toMatch(/Hello \d{13}!/);
  });

  it('fails on invalid template', async () => {
    try {
      await renderUtils.render('Hello {{ msg }!', {msg: 'World'});
      fail('Render should have failed');
    } catch (err) {
      expect(err.message).toContain('expected variable end');
    }
  });
});

describe('buildRenderContext()', () => {
  it('cascades properly', async () => {
    const ancestors = [
      {
        type: models.requestGroup.type,
        environment: {foo: 'parent', ancestor: true}
      },
      {
        type: models.requestGroup.type,
        environment: {foo: 'grandparent', ancestor: true}
      },
    ];

    const rootEnvironment = {
      type: models.environment.type,
      data: {foo: 'root', root: true}
    };

    const subEnvironment = {
      type: models.environment.type,
      data: {foo: 'sub', sub: true}
    };

    const context = await renderUtils.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({
      foo: 'parent',
      ancestor: true,
      root: true,
      sub: true
    });
  });

  it('rendered recursive should not infinite loop', async () => {
    const ancestors = [{
      // Sub Environment
      type: models.requestGroup.type,
      environment: {recursive: '{{ recursive }}/hello'}
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    // This is longer than 3 because it multiplies every time (1 -> 2 -> 4 -> 8)
    expect(context).toEqual({
      recursive: '{{ recursive }}/hello/hello/hello/hello/hello/hello/hello/hello'
    });
  });

  it('render up to 3 recursion levels', async () => {
    const ancestors = [{
      // Sub Environment
      type: models.requestGroup.type,
      environment: {
        d: '/d',
        c: '/c{{ d }}',
        b: '/b{{ c }}',
        a: '/a{{ b }}',
        test: 'http://insomnia.rest{{ a }}'
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    expect(context).toEqual({
      d: '/d',
      c: '/c/d',
      b: '/b/c/d',
      a: '/a/b/c/d',
      test: 'http://insomnia.rest/a/b/c/d',
    });
  });

  it('rendered sibling environment variables', async () => {
    const ancestors = [{
      // Sub Environment
      type: models.requestGroup.type,
      environment: {
        sibling: 'sibling',
        test: '{{ sibling }}/hello'
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    expect(context).toEqual({sibling: 'sibling', test: 'sibling/hello'});
  });

  it('rendered parent environment variables', async () => {
    const ancestors = [{
      name: 'Parent',
      type: models.requestGroup.type,
      environment: {
        test: '{{ grandparent }} parent'
      }
    }, {
      name: 'Grandparent',
      type: models.requestGroup.type,
      environment: {
        grandparent: 'grandparent'
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    expect(context).toEqual({grandparent: 'grandparent', test: 'grandparent parent'});
  });

  it('rendered parent same name environment variables', async () => {
    const ancestors = [{
      name: 'Parent',
      type: models.requestGroup.type,
      environment: {
        base_url: '{{ base_url }}/resource'
      }
    }, {
      name: 'Grandparent',
      type: models.requestGroup.type,
      environment: {
        base_url: 'https://insomnia.rest'
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    expect(context).toEqual({base_url: 'https://insomnia.rest/resource'});
  });

  it('rendered parent, ignoring sibling environment variables', async () => {
    const ancestors = [{
      name: 'Parent',
      type: models.requestGroup.type,
      environment: {
        host: 'parent.com',
      }
    }, {
      name: 'Grandparent',
      type: models.requestGroup.type,
      environment: {
        host: 'grandparent.com',
        node: {
          admin: 'admin',
          test: 'test',
          port: 8080,
        },
        urls: {
          admin: 'https://{{ host }}/{{ node.admin }}',
          test: 'https://{{ host }}/{{ node.test }}',
        }
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);
    const result = await renderUtils.render('{{ urls.admin }}/foo', context);

    expect(result).toEqual('https://parent.com/admin/foo');
  });

  it('renders child environment variables', async () => {
    const ancestors = [{
      name: 'Parent',
      type: models.requestGroup.type,
      environment: {
        parent: 'parent',
      }
    }, {
      name: 'Grandparent',
      type: models.requestGroup.type,
      environment: {
        test: '{{ parent }} grandparent'
      }
    }];

    const context = await renderUtils.buildRenderContext(ancestors);

    expect(context).toEqual({parent: 'parent', test: 'parent grandparent'});
  });

  it('cascades properly and renders', async () => {
    const ancestors = [
      {
        type: models.requestGroup.type,
        environment: {
          url: '{{ base_url }}/resource',
          ancestor: true,
          winner: 'folder parent'
        }
      },
      {
        type: models.requestGroup.type,
        environment: {
          ancestor: true,
          winner: 'folder grandparent'
        }
      }
    ];

    const subEnvironment = {
      type: models.environment.type,
      data: {winner: 'sub', sub: true, base_url: 'https://insomnia.rest'}
    };

    const rootEnvironment = {
      type: models.environment.type,
      data: {winner: 'root', root: true, base_url: 'ignore this'}
    };

    const context = await renderUtils.buildRenderContext(ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({
      base_url: 'https://insomnia.rest',
      url: 'https://insomnia.rest/resource',
      ancestor: true,
      winner: 'folder parent',
      root: true,
      sub: true
    });
  });

  it('works with minimal parameters', async () => {
    const ancestors = null;
    const rootEnvironment = null;
    const subEnvironment = null;

    const context = await renderUtils.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({});
  });
});

describe('recursiveRender()', () => {
  it('correctly renders simple Object', async () => {
    const newObj = await renderUtils.recursiveRender({
      foo: '{{ foo }}',
      bar: 'bar',
      baz: '{{ bad }}'
    }, {foo: 'bar'});

    expect(newObj).toEqual({
      foo: 'bar',
      bar: 'bar',
      baz: ''
    })
  });

  it('correctly renders complex Object', async () => {
    const d = new Date();
    const obj = {
      foo: '{{ foo }}',
      null: null,
      bool: true,
      date: d,
      undef: undefined,
      num: 1234,
      nested: {
        foo: '{{ foo }}',
        arr: [1, 2, '{{ foo }}']
      }
    };

    const newObj = await renderUtils.recursiveRender(obj, {foo: 'bar'});

    expect(newObj).toEqual({
      foo: 'bar',
      null: null,
      bool: true,
      date: d,
      undef: undefined,
      num: 1234,
      nested: {
        foo: 'bar',
        arr: [1, 2, 'bar']
      }
    });

    // Make sure original request isn't changed
    expect(obj.foo).toBe('{{ foo }}');
    expect(obj.nested.foo).toBe('{{ foo }}');
    expect(obj.nested.arr[2]).toBe('{{ foo }}');
  });

  it('fails on bad template', async () => {
    try {
      await renderUtils.recursiveRender({
        foo: '{{ foo }',
        bar: 'bar',
        baz: '{{ bad }}'
      }, {foo: 'bar'});
      fail('Render should have failed');
    } catch (err) {
      expect(err.message).toContain('expected variable end');
    }
  })
});
