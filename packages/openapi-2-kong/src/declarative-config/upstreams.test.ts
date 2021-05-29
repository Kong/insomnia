import { getSpec } from '../common';
import { DCUpstream } from '../types';
import { xKongUpstreamDefaults } from '../types/kong';
import { generateUpstreams } from './upstreams';

/** This function is written in such a way as to allow mutations in tests but without affecting other tests. */
const getSpecResult = (): DCUpstream =>
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
    expect(generateUpstreams(spec, ['Tag'])).toEqual<DCUpstream[]>([specResult]);
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
    expect(generateUpstreams(spec, ['Tag'])).toEqual<DCUpstream[]>([specResult]);
  });
});
