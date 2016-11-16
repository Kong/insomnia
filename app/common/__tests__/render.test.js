import * as renderUtils from '../render';
import * as models from '../../models';

jest.mock('electron');

describe('render()', () => {
  it('renders hello world', () => {
    const rendered = renderUtils.render('Hello {{ msg }}!', {msg: 'World'});
    expect(rendered).toBe('Hello World!');
  });

  it('renders custom tag: uuid', () => {
    const rendered = renderUtils.render('Hello {% uuid %}!');
    expect(rendered).toMatch(/Hello [a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}!/);
  });

  it('renders custom tag: timestamp', () => {
    const rendered = renderUtils.render('Hello {% timestamp %}!');
    expect(rendered).toMatch(/Hello \d{13}!/);
  });

  it('fails on invalid template', () => {
    const fn = () => renderUtils.render('Hello {{ msg }!', {msg: 'World'});
    expect(fn).toThrowError('expected variable end');
  });
});

describe('buildRenderContext()', () => {
  it('cascades properly', () => {
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

    const context = renderUtils.buildRenderContext(
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

  it('cascades properly and renders', () => {
    const ancestors = [
      {
        type: models.requestGroup.type,
        environment: {bar: '{{ foo }} parent', recursive: '{{ recursive }}', ancestor: true}
      },
      {
        type: models.requestGroup.type,
        environment: {bar: '{{ foo }} grandparent', ancestor: true}
      }
    ];

    const rootEnvironment = {
      type: models.environment.type,
      data: {foo: 'root', root: true}
    };

    const subEnvironment = {
      type: models.environment.type,
      data: {foo: 'sub', sub: true}
    };

    const context = renderUtils.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({
      foo: 'sub',
      bar: 'sub parent',
      recursive: '{{ recursive }}',
      ancestor: true,
      root: true,
      sub: true
    });
  });

  it('works with minimal parameters', () => {
    const ancestors = null;
    const rootEnvironment = null;
    const subEnvironment = null;

    const context = renderUtils.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({});
  });
});

describe('recursiveRender()', () => {
  it('correctly renders simple Object', () => {
    const newObj = renderUtils.recursiveRender({
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

  it('correctly renders complex Object', () => {
    const d = new Date();
    const obj = {
      foo: '{{ foo }}',
      null: null,
      bool: true,
      date: d,
      num: 1234,
      nested: {
        foo: '{{ foo }}',
        arr: [1, 2, '{{ foo }}']
      }
    };

    const newObj = renderUtils.recursiveRender(obj, {foo: 'bar'});

    expect(newObj).toEqual({
      foo: 'bar',
      null: null,
      bool: true,
      date: d,
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

  it('fails on bad template', () => {
    const fn = () => renderUtils.recursiveRender({
      foo: '{{ foo }',
      bar: 'bar',
      baz: '{{ bad }}'
    }, {foo: 'bar'});

    expect(fn).toThrowError('expected variable end');
  })
});
