// @flow

import { getName, parseUrl, fillServerVariables } from '../common';

export function generateUpstreams(api: OpenApi3Spec, tags: Array<string>) {
  const servers = api.servers || [];

  if (servers.length === 0) {
    return [];
  }

  const upstream: DCUpstream = {
    name: getName(api),
    targets: [],
    tags,
  };

  for (const server of servers) {
    const serverWithVars = fillServerVariables(server);
    upstream.targets.push({
      target: parseUrl(serverWithVars).host,
    });
  }

  return [upstream];
}
