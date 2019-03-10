import Store from '../';
import MemoryDriver from '../drivers/memory-driver';

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

        expect(await s.setItem('obj', { foo: 'bar' })).toBe(undefined);
        expect(await s.getItem('obj')).toEqual({ foo: 'bar' });

        expect(await s.removeItem('foo')).toBe(undefined);
        expect(await s.hasItem('foo')).toBe(false);
        expect(await s.getItem('foo')).toBe(null);
      });

      it('clears all values', async () => {
        const d = new Driver();

        await d.setItem('a', 'aaa');
        await d.setItem('b', 'bbb');
        await d.clear();

        expect(await d.hasItem('a')).toBe(false);
        expect(await d.hasItem('b')).toBe(false);
      });
    });
  }
});

describe('hooks', async () => {
  const s = new Store(new MemoryDriver(), [
    {
      read: s => decodeURIComponent(s),
      write: s => encodeURIComponent(s),
    },
  ]);

  await s.setItem('foo', 'Hello World!');
  expect(await s._driver.getItem('foo')).toBe('%22Hello%20World!%22');
  expect(await s.getItem('foo')).toBe('Hello World!');
});
