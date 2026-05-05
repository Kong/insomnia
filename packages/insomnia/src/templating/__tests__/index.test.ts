import { describe, expect, it } from 'vitest';

import { render } from '../index';

describe('templating/index (Node environment)', () => {
  it('renders a simple variable template', async () => {
    const result = await render('{{ name }}', { context: { name: 'world' } });
    expect(result).toBe('world');
  });

  it('renders nested context via _ accessor', async () => {
    const result = await render('{{ _.greeting }}', { context: { greeting: 'hello' } });
    expect(result).toBe('hello');
  });

  it('returns plain text unchanged', async () => {
    const result = await render('no template here');
    expect(result).toBe('no template here');
  });
});
