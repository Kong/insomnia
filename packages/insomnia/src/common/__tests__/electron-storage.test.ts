import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ElectronStorage from '../../main/electron-storage';

describe('Test electron storage()', () => {
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('create directory', () => {
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;

    const ls = new ElectronStorage(basePath);
    expect(ls).toBeInstanceOf(ElectronStorage);

    const dir = fs.readdirSync(basePath);
    expect(dir.length).toEqual(0);
  });

  it('does basic operations', () => {
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;
    const electronStorage = new ElectronStorage(basePath);

    // Test get and set
    electronStorage.setItem('foo', 'bar 1');
    electronStorage.setItem('foo', 'bar');
    expect(electronStorage.getItem('foo', 'BAD')).toBe('bar');

    // Test Object storage
    electronStorage.setItem('obj', {
      foo: 'bar',
      arr: [1, 2, 3],
    });
    expect(electronStorage.getItem('obj')).toEqual({
      foo: 'bar',
      arr: [1, 2, 3],
    });

    // Test default values
    expect(electronStorage.getItem('dne', 'default')).toEqual('default');
    expect(electronStorage.getItem('dne')).toEqual('default');
  });

  it('does handles malformed files', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;
    const electronStorage = new ElectronStorage(basePath);

    // Assert default is returned on bad JSON
    fs.writeFileSync(path.join(basePath, 'key'), '{bad JSON');
    expect(electronStorage.getItem('key', 'default')).toBe('default');

    // Assert that writing our file actually works
    fs.writeFileSync(path.join(basePath, 'key'), '{"good": "JSON"}');
    expect(electronStorage.getItem('key', 'default')).toEqual({
      good: 'JSON',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('does handles failing to write file', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;
    const electronStorage = new ElectronStorage(basePath);
    fs.rmdirSync(basePath);
    electronStorage.setItem('key', 'value');

    // Since the above operation failed to write, we should now get back
    // the default value
    expect(electronStorage.getItem('key', 'different')).toBe('different');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('stores a key', () => {
    vi.useFakeTimers();
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;
    const electronStorage = new ElectronStorage(basePath);
    electronStorage.setItem('foo', 'bar');

    // Force debouncer to flush
    vi.runOnlyPendingTimers();

    // Assert there is one item stored
    expect(fs.readdirSync(basePath).length).toEqual(1);

    // Assert the contents are correct
    const contents = fs.readFileSync(path.join(basePath, 'foo'), 'utf8');
    expect(contents).toEqual('"bar"');
  });

  it('debounces key sets', () => {
    vi.useFakeTimers();
    const basePath = `/tmp/insomnia-electronstorage-${Math.random()}`;
    const electronStorage = new ElectronStorage(basePath);
    electronStorage.setItem('foo', 'bar1');
    electronStorage.setItem('another', 10);
    electronStorage.setItem('foo', 'bar3');
    expect(fs.readdirSync(basePath).length).toEqual(0);

    // Force debouncer to flush
    vi.runOnlyPendingTimers();

    // Make sure only one item exists
    expect(fs.readdirSync(basePath).length).toEqual(2);
    expect(fs.readFileSync(path.join(basePath, 'foo'), 'utf8')).toEqual('"bar3"');
    expect(fs.readFileSync(path.join(basePath, 'another'), 'utf8')).toEqual('10');
  });
});
