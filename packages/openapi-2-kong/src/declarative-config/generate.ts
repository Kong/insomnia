import { hasUpstreams } from '../common';
import { DeclarativeConfig } from '../types/declarative-config';
import { OpenApi3Spec } from '../types/openapi3';
import { DeclarativeConfigResult } from '../types/outputs';
import { generateServices } from './services';
import { generateUpstreams } from './upstreams';

export function generateDeclarativeConfigFromSpec(
  api: OpenApi3Spec,
  tags: string[],
  legacy: Boolean = true
) {
  try {
    const formatVersion = legacy ? '1.1' : '3.0';
    const document: DeclarativeConfig = {
      _format_version: formatVersion,
      services: generateServices(api, tags, legacy),
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

    /**
     * There was an [issue](https://github.com/Kong/studio/issues/93) that required us to stringify and parse the declarative config object containing circular dependencies.
     * However, that fix didn't seem to clear the issue of the circular dependencies completely.
     *
     * It is attempted to resolve the circular issue by bundling the openapi spec using SwaggerParser.bundle() method, which resolves all the schemas into $ref instead of dereferencing them.
     * Then, we would just dump the components part of it with $schema property, so any JSON parsing logic can refer to the components object.
     *
     * Therefore, JSON.parse(JSON.stringify(result)) doesn't seem to be needed any more.
     */
    return declarativeConfigResult;
  } catch (err) {
    throw new Error('Failed to generate spec: ' + err.message);
  }
}
