import { generate, generateFromString } from '../index';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';

describe('index', () => {
  describe('generate()', () => {
    it('generates DC from file', async () => {
      const p = path.join(__dirname, '../__fixtures__/uspto.yaml');
      const dc = await generate(p);
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc.upstreams.length).toBe(1);
    });

    it('generates DC from file with extra tags', async () => {
      const p = path.join(__dirname, '../__fixtures__/uspto.yaml');
      const dc = await generate(p, ['MyTag']);
      expect(dc._format_version).toBe('1.1');
      expect(dc.services.length).toBe(1);
      expect(dc.services[0].tags).toEqual(['OAS3_import', 'OAS3file_uspto.yaml', 'MyTag']);
    });
  });

  describe('generateFromString()', () => {
    it('generates DC from string', async () => {
      const s = fs.readFileSync(path.join(__dirname, '../__fixtures__/uspto.yaml'), 'utf8');
      const dc = await generateFromString(s);
      expect(dc._format_version).toBe('1.1');
    });
  });

  describe('generateFromSpec()', () => {
    it('generates DC from spec', async () => {
      const s = YAML.parse(
        fs.readFileSync(path.join(__dirname, '../__fixtures__/uspto.yaml'), 'utf8'),
      );
      const dc = await generateFromString(s);
      expect(dc._format_version).toBe('1.1');
    });
  });
});
