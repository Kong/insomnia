import { describe, expect, it } from '@jest/globals';

import MemoryDriver from '../drivers/memory-driver';
import Store from '../index';

describe('store', () => {
  for (const Driver of [MemoryDriver]) {
    describe(Driver.name, () => {
      it('supports CRUD operations', async () => {
        const s = new Store(new Driver());
        expect(await s.hasItem('404')).toBe(false);
        expect(await s.getItem('404')).toBe(null);
        expect(await s.setItem('foo', 'bar')).toBe(undefined);
        expect(await s.getItem('foo')).toBe('bar');
        expect(await s.setItem('null', null)).toBe(undefined);
        expect(await s.getItem('null')).toBe(null);
        expect(
          await s.setItem('obj', {
            foo: 'bar',
          }),
        ).toBe(undefined);
        expect(await s.getItem('obj')).toEqual({
          foo: 'bar',
        });
        expect(await s.removeItem('foo')).toBe(undefined);
        expect(await s.hasItem('foo')).toBe(false);
        expect(await s.getItem('foo')).toBe(null);
      });

      it('clears all values', async () => {
        const s = new Store(new Driver());
        await s.setItem('a', 'aaa');
        await s.setItem('b', 'bbb');
        await s.clear();
        expect(await s.hasItem('a')).toBe(false);
        expect(await s.hasItem('b')).toBe(false);
      });

      it('stores buffers directly', async () => {
        const s = new Store(new Driver());
        await s.setItem('buff', Buffer.from('{"hi": "there"}', 'utf8'));
        await s.setItem('json', {
          hi: 'there',
        });
        expect(await s.getItem('buff')).toEqual({
          hi: 'there',
        });
        expect(await s.getItem('json')).toEqual({
          hi: 'there',
        });
        expect((await s._driver.getItem('buff')).toString('utf8')).toEqual('{"hi": "there"}');
        expect((await s._driver.getItem('json')).toString('utf8')).toEqual('{\n  "hi": "there"\n}');
      });
    });
  }

  it('supports hooks', async () => {
    const s = new Store(new MemoryDriver(), [
      {
        // Just some dumb hooks to test with
        read: (_ext, buff) => Buffer.from(buff.toString('utf8').replace('WORLD', 'World')),
        write: (_ext, buff) => Buffer.from(buff.toString('utf8').replace('World', 'WORLD')),
      },
    ]);
    await s.setItem('foo', {
      Hello: 'World!',
    });
    expect((await s._driver.getItem('foo')).toString('utf8')).toBe('{\n  "Hello": "WORLD!"\n}');
    expect(await s.getItem('foo')).toEqual({
      Hello: 'World!',
    });
  });
});
