import * as render from '../render';
import {TYPE_ENVIRONMENT, TYPE_REQUEST_GROUP} from '../../database/index';

jest.mock('electron');

describe('render()', () => {
  it('renders hello world', () => {
    const rendered = render.render('Hello {{ msg }}!', {msg: 'World'});
    expect(rendered).toBe('Hello World!');
  });

  it('renders custom tag: uuid', () => {
    const rendered = render.render('Hello {% uuid %}!');
    expect(rendered).toBe('Hello b5c2f089-2c0c-46b6-a6f1-8d5b86cbc603!');
  });

  it('renders custom tag: timestamp', () => {
    const rendered = render.render('Hello {% timestamp %}!');
    expect(rendered).toMatch(/Hello \d{13}!/);
  });

  it('fails on invalid template', () => {
    const fn = () => render.render('Hello {{ msg }!', {msg: 'World'});
    expect(fn).toThrowError('expected variable end');
  });
});

describe('buildRenderContext()', () => {
  it('cascades properly', () => {
    const ancestors = [{
      type: TYPE_REQUEST_GROUP,
      environment: {foo: 'group 2', ancestor: true}
    }, {
      type: TYPE_REQUEST_GROUP,
      environment: {foo: 'group 1', ancestor: true}
    }];

    const rootEnvironment = {
      type: TYPE_ENVIRONMENT,
      data: {foo: 'root', root: true}
    };

    const subEnvironment = {
      type: TYPE_ENVIRONMENT,
      data: {foo: 'sub', sub: true}
    };

    const context = render.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({
      foo: 'group 1',
      ancestor: true,
      root: true,
      sub: true
    });
  });

  it('cascades properly and renders', () => {
    const ancestors = [{
      type: TYPE_REQUEST_GROUP,
      environment: {bar: '{{ foo }} 2', recursive: '{{ recursive }}', ancestor: true}
    }, {
      type: TYPE_REQUEST_GROUP,
      environment: {bar: '{{ foo }} 1', ancestor: true}
    }];

    const rootEnvironment = {
      type: TYPE_ENVIRONMENT,
      data: {foo: 'root', root: true}
    };

    const subEnvironment = {
      type: TYPE_ENVIRONMENT,
      data: {foo: 'sub', sub: true}
    };

    const context = render.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({
      foo: 'sub',
      bar: 'sub 1',
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

    const context = render.buildRenderContext(
      ancestors,
      rootEnvironment,
      subEnvironment
    );

    expect(context).toEqual({});
  });
});

describe('recursiveRender()', () => {
  it('correctly renders simple Object', () => {
    const newObj = render.recursiveRender({
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
        arr: [1,2, '{{ foo }}']
      }
    };

    const newObj = render.recursiveRender(obj, {foo: 'bar'});

    expect(newObj).toEqual({
      foo: 'bar',
      null: null,
      bool: true,
      date: d,
      num: 1234,
      nested: {
        foo: 'bar',
        arr: [1,2, 'bar']
      }
    });

    // Make sure original request isn't changed
    expect(obj.foo).toBe('{{ foo }}');
    expect(obj.nested.foo).toBe('{{ foo }}');
    expect(obj.nested.arr[2]).toBe('{{ foo }}');
  });

  it('fails on bad template', () => {
    const fn = () => render.recursiveRender({
      foo: '{{ foo }',
      bar: 'bar',
      baz: '{{ bad }}'
    }, {foo: 'bar'});

    expect(fn).toThrowError('expected variable end');
  })
});
