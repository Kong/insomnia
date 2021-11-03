import { hasUpstreams } from '../common';
import { DeclarativeConfig } from '../types/declarative-config';
import { OpenApi3Spec } from '../types/openapi3';
import { DeclarativeConfigResult } from '../types/outputs';
import { generateServices } from './services';
import { generateUpstreams } from './upstreams';

export function generateDeclarativeConfigFromSpec(
  api: OpenApi3Spec,
  tags: string[],
) {
  try {
    const document: DeclarativeConfig = {
      _format_version: '1.1',
      services: generateServices(api, tags),
    };

    if (hasUpstreams(api)) {
      document.upstreams = generateUpstreams(api, tags);
    }

    const declarativeConfigResult: DeclarativeConfigResult = {
      type: 'kong-declarative-config',
      label: 'Kong Declarative Config',
      documents: [document],
      warnings: [],
    };

    // This removes any circular references or weirdness that might result from the JS objects used.
    // see: https://github.com/Kong/studio/issues/93
    const result: DeclarativeConfigResult = JSON.parse(JSON.stringify(declarativeConfigResult));
    return result;
  } catch (err) {
    throw new Error('Failed to generate spec: ' + err.message);
  }
}
