import * as render from '../render';
import {TYPE_ENVIRONMENT, TYPE_REQUEST_GROUP} from '../../database/index';

jest.mock('electron');

describe('render()', () => {
  it('renders hello world', () => {
    const rendered = render.render('Hello {{ msg }}!', {msg: 'World'});
    expect(rendered).toBe('Hello World!');
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
    const newObj = render.recursiveRender({
      foo: '{{ foo }}',
      null: null,
      bool: true,
      date: d,
      num: 1234,
      nested: {
        foo: '{{ foo }}',
        arr: [1,2, '{{ foo }}']
      }
    }, {foo: 'bar'});

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
    })
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

describe('setDefaultProtocol()', () => {
  it('correctly sets protocol for empty', () => {
    const url = render.setDefaultProtocol('google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for valid url', () => {
    const url = render.setDefaultProtocol('https://google.com');
    expect(url).toBe('https://google.com');
  });

  it('does not set for valid url', () => {
    const url = render.setDefaultProtocol('http://google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for invalid url', () => {
    const url = render.setDefaultProtocol('httbad://google.com');
    expect(url).toBe('httbad://google.com');
  });
});
