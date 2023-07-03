import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';
import YAML from 'yaml';

import { generate, generateFromSpec, generateFromString, parseSpec } from './generate';
import { OpenApi3Spec } from './types/openapi3';
import { DeclarativeConfigResult, KongForKubernetesResult } from './types/outputs';

const firstK8sDocument = {
  apiVersion: 'configuration.konghq.com/v1',
  kind: 'KongIngress',
  metadata: {
    name: 'get-method',
  },
  route: {
    methods: [
      // There was some discrepency how we "generate" mock data and how we implemented it
      'get',
    ],
  },
};

const dcFixturesLocation = 'declarative-config/fixtures';
const dcFixtureFilepath = path.join(__dirname, dcFixturesLocation, 'uspto.yaml');
const dcFixtureFileString = fs.readFileSync(dcFixtureFilepath, 'utf-8');

const k8sFixturesLocation = 'kubernetes/fixtures';
const k8sFixtureFilepath = path.join(__dirname, k8sFixturesLocation, 'cloud-api.yaml');
const k8sFixtureFileString = fs.readFileSync(k8sFixtureFilepath, 'utf-8');

describe('top-level API exports', () => {
  describe('generate()', () => {
    it('generates DC from file', async () => {
      const {
        documents: [dc],
      } = await generate(dcFixtureFilepath, 'kong-declarative-config') as DeclarativeConfigResult;
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc).not.toHaveProperty('upstreams');
    });

    it('generates DC from file with extra tags', async () => {
      const {
        documents: [dc],
      } = await generate(dcFixtureFilepath, 'kong-declarative-config', ['MyTag']) as DeclarativeConfigResult;
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc.services[0].tags).toEqual(['OAS3_import', 'OAS3file_uspto.yaml', 'MyTag']);
    });

    it('generates kubernetes from file', async () => {
      const {
        type,
        label,
        documents,
        warnings,
      } = await generate(k8sFixtureFilepath, 'kong-for-kubernetes') as KongForKubernetesResult;
      expect(type).toBe('kong-for-kubernetes');
      expect(label).toBe('Kong for Kubernetes');
      expect(documents).toHaveLength(9);
      expect(documents[0]).toMatchObject(firstK8sDocument);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('generateFromString()', () => {
    it('generates DC from string', async () => {
      const {
        documents: [dc],
      } = await generateFromString(k8sFixtureFileString, 'kong-declarative-config') as DeclarativeConfigResult;
      expect(dc._format_version).toBe('1.1');
    });

    it('generates kubernetes from string', async () => {
      const {
        type,
        label,
        documents,
        warnings,
      } = await generateFromString(k8sFixtureFileString, 'kong-for-kubernetes') as KongForKubernetesResult;
      expect(type).toBe('kong-for-kubernetes');
      expect(label).toBe('Kong for Kubernetes');
      expect(documents).toHaveLength(9);
      expect(documents[0]).toMatchObject(firstK8sDocument);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('generateFromSpec()', () => {
    it('generates DC from spec', async () => {
      const parsedSpec = YAML.parse(dcFixtureFileString);
      const {
        documents: [dc],
      } = await generateFromSpec(parsedSpec, 'kong-declarative-config') as DeclarativeConfigResult;
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc).not.toHaveProperty('upstreams');
    });

    it('generates kubernetes from spec', async () => {
      const parsedSpec = YAML.parse(k8sFixtureFileString);
      const {
        type,
        label,
        documents,
        warnings,
      } = await generateFromSpec(parsedSpec, 'kong-for-kubernetes') as KongForKubernetesResult;
      expect(type).toBe('kong-for-kubernetes');
      expect(label).toBe('Kong for Kubernetes');
      expect(documents).toHaveLength(9);
      expect(documents[0]).toMatchObject(firstK8sDocument);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('parseSpec()', () => {
    const partialSpec: Partial<OpenApi3Spec> = {
      openapi: '3.0',
      paths: {
        '/': {
          post: {
            responses: {
              200: {
                $ref: '#/components/schemas/dog',
              },
            },
          },
        },
      },
      components: {
        schemas: {
          dog: {
            description: 'OK',
          } as OpenAPIV3.SchemaObject,
        },
      },
    };
    const specResolved: OpenApi3Spec = {
      openapi: '3.0.0',
      components: partialSpec.components,
      info: {
        title: '',
        version: '',
      },
      paths: {
        '/': {
          post: {
            responses: {
              200: {
                description: 'OK',
              } as OpenAPIV3.SchemaObject,
            } as OpenAPIV3.ResponsesObject,
          },
        },
      },
    };

    it('parses JSON spec', async () => {
      const result = await parseSpec(partialSpec);
      expect(result).toEqual(specResolved);
    });

    it('parses JSON spec string', async () => {
      const result = await parseSpec(JSON.stringify(partialSpec));
      expect(result).toEqual(specResolved);
    });

    it('parses YAML spec string', async () => {
      const result = await parseSpec(YAML.stringify(partialSpec));
      expect(result).toEqual(specResolved);
    });
  });
});
