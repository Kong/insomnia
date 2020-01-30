// @flow
import { generateServices } from './services';
import { generateUpstreams } from './upstreams';

export function generateDeclarativeConfigFromSpec(
  api: OpenApi3Spec,
  tags: Array<string>,
): DeclarativeConfigResult {
  let result = null;
  try {
    result = {
      _format_version: '1.1',
      services: generateServices(api, tags),
      upstreams: generateUpstreams(api, tags),
    };
  } catch (err) {
    throw new Error('Failed to generate spec: ' + err.message);
  }

  // This remover any circular references or weirdness that might result
  // from the JS objects used.
  // SEE: https://github.com/Kong/studio/issues/93
  const document = JSON.parse(JSON.stringify(result));

  return {
    type: 'kong-declarative-config',
    label: 'Kong Declarative Config',
    document,
    warnings: [],
  };
}
