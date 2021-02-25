import path from 'path';
import fs from 'fs';
import LocalStorage from '../../main/local-storage';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('LocalStorage()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    jest.useFakeTimers();

    // There has to be a better way to reset this...
    setTimeout.mock.calls = [];
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('create directory', () => {
    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const ls = new LocalStorage(basePath);
    expect(ls).toBeInstanceOf(LocalStorage);
    const dir = fs.readdirSync(basePath);
    expect(dir.length).toEqual(0);
  });

  it('does basic operations', () => {
    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const localStorage = new LocalStorage(basePath);

    // Test get and set
    localStorage.setItem('foo', 'bar 1');
    localStorage.setItem('foo', 'bar');
    expect(localStorage.getItem('foo', 'BAD')).toBe('bar');

    // Test Object storage
    localStorage.setItem('obj', { foo: 'bar', arr: [1, 2, 3] });
    expect(localStorage.getItem('obj')).toEqual({ foo: 'bar', arr: [1, 2, 3] });

    // Test default values
    expect(localStorage.getItem('dne', 'default')).toEqual('default');
    expect(localStorage.getItem('dne')).toEqual('default');
  });

  it('does handles malformed files', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const localStorage = new LocalStorage(basePath);

    // Assert default is returned on bad JSON
    fs.writeFileSync(path.join(basePath, 'key'), '{bad JSON');
    expect(localStorage.getItem('key', 'default')).toBe('default');

    // Assert that writing our file actually works
    fs.writeFileSync(path.join(basePath, 'key'), '{"good": "JSON"}');
    expect(localStorage.getItem('key', 'default')).toEqual({ good: 'JSON' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('does handles failing to write file', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const localStorage = new LocalStorage(basePath);
    fs.rmdirSync(basePath);
    localStorage.setItem('key', 'value');

    jest.runAllTimers();

    // Since the above operation failed to write, we should now get back
    // the default value
    expect(localStorage.getItem('key', 'different')).toBe('different');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('stores a key', () => {
    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const localStorage = new LocalStorage(basePath);
    localStorage.setItem('foo', 'bar');

    // Assert timeouts are called
    expect(setTimeout.mock.calls.length).toBe(1);
    expect(setTimeout.mock.calls[0][1]).toBe(100);

    // Force debouncer to flush
    jest.runAllTimers();

    // Assert there is one item stored
    expect(fs.readdirSync(basePath).length).toEqual(1);

    // Assert the contents are correct
    const contents = fs.readFileSync(path.join(basePath, 'foo'), 'utf8');
    expect(contents).toEqual('"bar"');
  });

  it('debounces key sets', () => {
    const basePath = `/tmp/insomnia-localstorage-${Math.random()}`;
    const localStorage = new LocalStorage(basePath);
    localStorage.setItem('foo', 'bar1');
    localStorage.setItem('another', 10);
    localStorage.setItem('foo', 'bar3');

    // Assert timeouts are called
    expect(setTimeout.mock.calls.length).toBe(3);
    expect(setTimeout.mock.calls[0][1]).toBe(100);
    expect(setTimeout.mock.calls[1][1]).toBe(100);
    expect(setTimeout.mock.calls[2][1]).toBe(100);

    expect(fs.readdirSync(basePath).length).toEqual(0);

    // Force flush
    jest.runAllTimers();

    // Make sure only one item exists
    expect(fs.readdirSync(basePath).length).toEqual(2);
    expect(fs.readFileSync(path.join(basePath, 'foo'), 'utf8')).toEqual('"bar3"');
    expect(fs.readFileSync(path.join(basePath, 'another'), 'utf8')).toEqual('10');
  });
});
