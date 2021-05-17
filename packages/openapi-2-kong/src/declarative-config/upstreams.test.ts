import { parseSpec } from '../..';
import { generateUpstreams } from './upstreams';
import { getSpec } from './utils';

const xKongUpstreamDefaults = 'x-kong-upstream-defaults';

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
  it('generates an upstream', async () => {
    const spec = getSpec();
    const specResult = getSpecResult();
    const api = await parseSpec(spec);
    expect(generateUpstreams(api, ['Tag'])).toEqual([specResult]);
  });

  it('throws for a root level x-kong-route-default', async () => {
    const spec = getSpec();
    spec[xKongUpstreamDefaults] = 'foo';
    const api = await parseSpec(spec);

    const fn = () => generateUpstreams(api, ['Tag']);

    expect(fn).toThrowError('expected \'x-kong-upstream-defaults\' to be an object');
  });

  it('ignores null for a root level x-kong-route-default', async () => {
    const spec = getSpec();
    spec[xKongUpstreamDefaults] = null;
    const specResult = getSpecResult();
    const api = await parseSpec(spec);
    expect(generateUpstreams(api, ['Tag'])).toEqual([specResult]);
  });
});
