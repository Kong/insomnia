import { xKongUpstreamDefaults } from '../types';
import { generateUpstreams } from './upstreams';
import { getSpec } from './utils';

/** This function is written in such a way as to allow mutations in tests but without affecting other tests. */
const getSpecResult = () =>
  JSON.parse(
    JSON.stringify({
      name: 'My_API',
      targets: [
        {
          target: 'server1.com:443',
          tags: ['Tag'],
        },
      ],
      tags: ['Tag'],
    }),
  );

describe('upstreams', () => {
  it('generates an upstream', () => {
    const spec = getSpec();
    const specResult = getSpecResult();
    expect(generateUpstreams(spec, ['Tag'])).toEqual([specResult]);
  });

  it('throws for a root level x-kong-route-default', () => {
    const spec = getSpec({
      // @ts-expect-error intentionally invalid
      [xKongUpstreamDefaults]: 'foo',
    });

    const fn = () => generateUpstreams(spec, ['Tag']);

    expect(fn).toThrowError(`expected '${xKongUpstreamDefaults}' to be an object`);
  });

  it('ignores null for a root level x-kong-route-default', () => {
    const spec = getSpec({
      // @ts-expect-error intentionally invalid
      [xKongUpstreamDefaults]: null,
    });
    const specResult = getSpecResult();
    expect(generateUpstreams(spec, ['Tag'])).toEqual([specResult]);
  });
});
