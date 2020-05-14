import { generate, generateFromString, parseSpec } from '../index';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';

describe('index', () => {
  describe('generate()', () => {
    it('generates DC from file', async () => {
      const p = path.join(__dirname, '../__fixtures__/uspto.yaml');
      const {
        documents: [dc],
      } = await generate(p, 'kong-declarative-config');
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc.upstreams.length).toBe(1);
    });

    it('generates DC from file with extra tags', async () => {
      const p = path.join(__dirname, '../__fixtures__/uspto.yaml');
      const {
        documents: [dc],
      } = await generate(p, 'kong-declarative-config', ['MyTag']);
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc.services[0].tags).toEqual(['OAS3_import', 'OAS3file_uspto.yaml', 'MyTag']);
    });
  });

  describe('generateFromString()', () => {
    it('generates DC from string', async () => {
      const s = fs.readFileSync(path.join(__dirname, '../__fixtures__/uspto.yaml'), 'utf8');
      const {
        documents: [dc],
      } = await generateFromString(s, 'kong-declarative-config');
      expect(dc._format_version).toBe('1.1');
    });
  });

  describe('generateFromSpec()', () => {
    it('generates DC from spec', async () => {
      const s = YAML.parse(
        fs.readFileSync(path.join(__dirname, '../__fixtures__/uspto.yaml'), 'utf8'),
      );
      const {
        documents: [dc],
      } = await generateFromString(s, 'kong-declarative-config');
      expect(dc._format_version).toBe('1.1');
    });
  });

  describe('parseSpec()', () => {
    const spec = {
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
          dog: { name: { type: 'string' } },
        },
      },
    };

    const specResolved = {
      openapi: '3.0.0',
      components: spec.components,
      info: {},
      paths: {
        '/': {
          post: {
            responses: {
              200: {
                name: { type: 'string' },
              },
            },
          },
        },
      },
    };

    it('parses JSON spec', async () => {
      const result = await parseSpec(spec);
      expect(result).toEqual(specResolved);
    });

    it('parses JSON spec string', async () => {
      const result = await parseSpec(JSON.stringify(spec));
      expect(result).toEqual(specResolved);
    });

    it('parses YAML spec string', async () => {
      const result = await parseSpec(YAML.stringify(spec));
      expect(result).toEqual(specResolved);
    });
  });
});
