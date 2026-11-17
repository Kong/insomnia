import fs from 'node:fs';

import type { RequestBodyParameter } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { buildMultipart } from '../../main/network/multipart';
import { parsePairs } from '../../ui/components/editors/body/bulk-pairs';
import { DEFAULT_BOUNDARY } from '../multipart-constants';

const dropDisabled = (params: RequestBodyParameter[]) => params.filter(param => !param.disabled);

const wireBytes = async (params: RequestBodyParameter[]) => {
  const { filePath } = await buildMultipart(dropDisabled(params));
  return fs.readFileSync(filePath, 'utf8');
};

describe('bulk form editor -> multipart wire format', () => {
  it('omits rows the user disabled with //', async () => {
    const body = await wireBytes(parsePairs(['lake:Victoria', '//forest:Mabira', 'river:Nile'].join('\n')));

    expect(body).toContain('name="lake"');
    expect(body).toContain('name="river"');
    expect(body).not.toContain('forest');
    expect(body).not.toContain('Mabira');
  });

  it('sends a value containing colons unchanged', async () => {
    const body = await wireBytes(parsePairs('surveyed_at:2025-01-15 09:30:00'));

    expect(body).toBe(
      [
        `--${DEFAULT_BOUNDARY}`,
        'Content-Disposition: form-data; name="surveyed_at"',
        '',
        '2025-01-15 09:30:00',
        `--${DEFAULT_BOUNDARY}--`,
        '',
      ].join('\r\n'),
    );
  });

  it('preserves trailing whitespace in a value', async () => {
    const body = await wireBytes(parsePairs('altitude:5109 '));

    expect(body).toContain('\r\n\r\n5109 \r\n');
  });

  it('keeps a held-aside file part, at its original position', async () => {
    const previous: RequestBodyParameter[] = [
      { name: 'park', value: 'Bwindi', disabled: false },
      { name: 'photo[0]', value: '', disabled: false, type: 'file', fileName: `${__dirname}/testfile.txt` },
      { name: 'lake', value: 'Victoria', disabled: false },
    ];
    const body = await wireBytes(parsePairs('park:Bwindi\nlake:Victoria', previous));

    expect(body).toContain('filename="testfile.txt"');
    expect(body.indexOf('name="photo[0]"')).toBeGreaterThan(body.indexOf('name="park"'));
    expect(body.indexOf('name="photo[0]"')).toBeLessThan(body.indexOf('name="lake"'));
  });

  it('keeps a held-aside part Content-Type', async () => {
    const previous: RequestBodyParameter[] = [
      { name: 'lake', value: 'Victoria', disabled: false },
      {
        name: 'geojson',
        value: '{"peak": "Margherita"}',
        disabled: false,
        type: 'text',
        multiline: 'application/json',
      },
    ];
    const body = await wireBytes(parsePairs('lake:Victoria', previous));

    expect(body).toContain('Content-Type: application/json');
    expect(body).toContain('{"peak": "Margherita"}');
  });

  it('produces a body identical to the equivalent key-value rows', async () => {
    const viaKeyValue: RequestBodyParameter[] = [
      { name: 'park', value: 'Bwindi Impenetrable', disabled: false },
      { name: 'lakes[0]', value: 'Victoria', disabled: false },
      { name: 'altitude', value: '5109', disabled: false },
    ];
    const viaBulk = parsePairs('park:Bwindi Impenetrable\nlakes[0]:Victoria\naltitude:5109');

    expect(await wireBytes(viaBulk)).toBe(await wireBytes(viaKeyValue));
  });
});
