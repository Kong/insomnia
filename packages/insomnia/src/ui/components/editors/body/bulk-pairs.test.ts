import type { RequestBodyParameter } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { BULK_EDIT_PLACEHOLDER, parsePairs, serializePairs } from './bulk-pairs';

const text = (name: string, value: string, disabled = false): RequestBodyParameter => ({ name, value, disabled });
const file = (name: string, fileName: string): RequestBodyParameter => ({
  name,
  value: '',
  disabled: false,
  type: 'file',
  fileName,
});

describe('serializePairs', () => {
  it('writes one `name:value` row per pair with no space after the separator', () => {
    expect(serializePairs([text('lake', 'Victoria'), text('river', 'Nile')])).toBe('lake:Victoria\nriver:Nile');
  });

  it('prefixes disabled rows with //', () => {
    expect(serializePairs([text('forest', 'Mabira', true)])).toBe('//forest:Mabira');
  });

  it('omits file rows, which text cannot represent', () => {
    const pairs = [text('park', 'Bwindi'), file('photo[0]', '/tmp/bwindi.jpg')];
    expect(serializePairs(pairs)).toBe('park:Bwindi');
  });

  it('omits values containing newlines, which would be read back as separate rows', () => {
    expect(serializePairs([text('lake', 'Victoria'), text('rivers', 'Nile\nKagera')])).toBe('lake:Victoria');
  });

  it('omits rows with neither a name nor a value', () => {
    expect(serializePairs([text('', ''), text('lake', 'Victoria')])).toBe('lake:Victoria');
  });

  it('keeps a row that has a name but no value', () => {
    expect(serializePairs([text('is_protected', '')])).toBe('is_protected:');
  });
});

describe('parsePairs', () => {
  it('reads a basic row', () => {
    expect(parsePairs('lake:Victoria')).toEqual([text('lake', 'Victoria')]);
  });

  it('splits on the first separator only, so values keep later ones', () => {
    expect(parsePairs('surveyed_at:2025-01-15 09:30:00')).toEqual([text('surveyed_at', '2025-01-15 09:30:00')]);
  });

  it('does not trim the value, because whitespace is meaningful in a form value', () => {
    expect(parsePairs('altitude:5109 ')).toEqual([text('altitude', '5109 ')]);
  });

  it('trims the name', () => {
    expect(parsePairs('  mountain  :Rwenzori')).toEqual([text('mountain', 'Rwenzori')]);
  });

  it('marks // rows disabled, with or without a following space', () => {
    expect(parsePairs('//lake:Victoria\n// river:Nile')).toEqual([
      text('lake', 'Victoria', true),
      text('river', 'Nile', true),
    ]);
  });

  it('keeps a value that itself starts with //', () => {
    expect(parsePairs('tiles://maps.example/bwindi')).toEqual([text('tiles', '//maps.example/bwindi')]);
  });

  it('skips blank and whitespace-only lines', () => {
    expect(parsePairs('lake:Victoria\n\n   \nriver:Nile')).toEqual([text('lake', 'Victoria'), text('river', 'Nile')]);
  });

  it('keeps a row with no separator as a name with an empty value', () => {
    expect(parsePairs('unnamed')).toEqual([text('unnamed', '')]);
  });

  it('skips a bare //', () => {
    expect(parsePairs('//\nlake:Victoria')).toEqual([text('lake', 'Victoria')]);
  });

  it('returns an empty array for empty input', () => {
    expect(parsePairs('')).toEqual([]);
    expect(parsePairs('   \n  ')).toEqual([]);
  });

  it('never throws, whatever the input', () => {
    const inputs = ['', ':', '::', '//', '// : ', '\n\n\n', 'a:b:c:d', '   :Victoria'];
    for (const input of inputs) {
      expect(() => parsePairs(input)).not.toThrow();
    }
  });
});

describe('parsePairs restoring held-aside rows', () => {
  it('puts a file row back at its original index', () => {
    const previous = [text('park', 'Bwindi'), file('photo[0]', '/tmp/bwindi.jpg'), text('lake', 'Victoria')];
    expect(parsePairs('park:Bwindi\nlake:Victoria', previous)).toEqual(previous);
  });

  it('keeps two adjacent file rows in order and position', () => {
    const previous = [
      text('park', 'Bwindi'),
      file('photo[0]', '/tmp/bwindi.jpg'),
      file('photo[1]', '/tmp/sipi-falls.jpg'),
      text('lake', 'Victoria'),
    ];
    expect(parsePairs('park:Bwindi\nlake:Victoria', previous)).toEqual(previous);
  });

  it('clamps to the end when the rows above a file were deleted', () => {
    const previous = [
      text('park', 'Bwindi'),
      text('lake', 'Victoria'),
      text('river', 'Nile'),
      file('photo[0]', '/tmp/bwindi.jpg'),
    ];
    expect(parsePairs('park:Bwindi', previous)).toEqual([text('park', 'Bwindi'), file('photo[0]', '/tmp/bwindi.jpg')]);
  });

  it('restores a file row when the buffer is empty', () => {
    const previous = [file('photo[0]', '/tmp/bwindi.jpg')];
    expect(parsePairs('', previous)).toEqual(previous);
  });

  it('restores a multiline value that was held aside', () => {
    const previous = [text('lake', 'Victoria'), text('rivers', 'Nile\nKagera')];
    expect(parsePairs('lake:Victoria', previous)).toEqual(previous);
  });
});

describe('round trip', () => {
  it('returns the original pairs unchanged', () => {
    const pairs = [
      text('park', 'Bwindi Impenetrable'),
      text('lakes[0]', 'Victoria'),
      text('lakes[1]', 'Bunyonyi'),
      text('surveyed_at', '2025-01-15 09:30:00'),
      text('summary', 'Margherita Peak crowns the Rwenzori range'),
      text('is_protected', '1'),
      file('photo[0]', '/tmp/bwindi.jpg'),
      file('photo[1]', '/tmp/sipi-falls.jpg'),
      text('altitude', '5109 '),
      text('note', 'Kidepo Valley survey pending', true),
    ];

    expect(parsePairs(serializePairs(pairs), pairs)).toEqual(pairs);
  });

  it('drops descriptions, which the format does not carry', () => {
    const pairs: RequestBodyParameter[] = [
      { name: 'lake', value: 'Victoria', disabled: false, description: 'largest in Africa' },
    ];
    expect(parsePairs(serializePairs(pairs), pairs)).toEqual([text('lake', 'Victoria')]);
  });
});

describe('rows carrying state the format cannot encode', () => {
  const multiline = (name: string, value: string, mode: boolean | string): RequestBodyParameter => ({
    name,
    value,
    disabled: false,
    type: 'text',
    multiline: mode,
  });

  it('holds aside a multiline row even when its value is a single line', () => {
    const pairs = [text('lake', 'Victoria'), multiline('geojson', '{}', true)];
    expect(serializePairs(pairs)).toBe('lake:Victoria');
    expect(parsePairs('lake:Victoria', pairs)).toEqual(pairs);
  });

  it('preserves a per-part Content-Type carried by multiline', () => {
    const pairs = [text('lake', 'Victoria'), multiline('geojson', '{"peak":"Margherita"}', 'application/json')];
    const restored = parsePairs(serializePairs(pairs), pairs);
    expect(restored).toEqual(pairs);
    expect(restored[1].multiline).toBe('application/json');
  });

  it('holds aside a value containing a carriage return', () => {
    const pairs = [text('lake', 'Victoria'), text('rivers', 'Nile\rKagera')];
    expect(serializePairs(pairs)).toBe('lake:Victoria');
    expect(parsePairs('lake:Victoria', pairs)).toEqual(pairs);
  });
});

describe('line endings', () => {
  it('parses CRLF input without leaving \\r on the values', () => {
    expect(parsePairs('lake:Victoria\r\nriver:Nile\r\n')).toEqual([text('lake', 'Victoria'), text('river', 'Nile')]);
  });

  it('parses lone CR input', () => {
    expect(parsePairs('lake:Victoria\rriver:Nile')).toEqual([text('lake', 'Victoria'), text('river', 'Nile')]);
  });

  it('ignores a trailing newline', () => {
    expect(parsePairs('lake:Victoria\n')).toEqual([text('lake', 'Victoria')]);
  });
});

describe('stability and scale', () => {
  it('is idempotent across repeated toggling', () => {
    const pairs = [text('lake', 'Victoria'), file('photo[0]', '/tmp/bwindi.jpg'), text('river', 'Nile ', true)];
    const once = parsePairs(serializePairs(pairs), pairs);
    const twice = parsePairs(serializePairs(once), once);
    const thrice = parsePairs(serializePairs(twice), twice);
    expect(twice).toEqual(once);
    expect(thrice).toEqual(once);
  });

  it('round-trips a large body without loss', () => {
    const pairs = Array.from({ length: 1000 }, (_, index) => text(`site[${index}]`, `Rwenzori camp ${index}`));
    expect(parsePairs(serializePairs(pairs), pairs)).toEqual(pairs);
  });

  it('preserves template tags verbatim', () => {
    const pairs = [text('token', '{{ _.authToken }}'), text('url', '{% base_url %}/parks')];
    expect(parsePairs(serializePairs(pairs), pairs)).toEqual(pairs);
  });

  it('preserves unicode and emoji', () => {
    const pairs = [text('greeting', 'Oli otya'), text('lake', 'Bunyonyi 🏞️')];
    expect(parsePairs(serializePairs(pairs), pairs)).toEqual(pairs);
  });
});

describe('parameter ids', () => {
  const withId = (name: string, value: string, id: string): RequestBodyParameter => ({
    name,
    value,
    disabled: false,
    id,
  });

  it('carries ids across an edit, so persisted params do not churn', () => {
    const previous = [withId('lake', 'Victoria', 'pair_1'), withId('river', 'Nile', 'pair_2')];
    expect(parsePairs('lake:Victoria\nriver:Kagera', previous)).toEqual([
      withId('lake', 'Victoria', 'pair_1'),
      withId('river', 'Kagera', 'pair_2'),
    ]);
  });

  it('leaves an appended row without an id, for the editor to mint', () => {
    const previous = [withId('lake', 'Victoria', 'pair_1')];
    expect(parsePairs('lake:Victoria\nriver:Nile', previous)).toEqual([
      withId('lake', 'Victoria', 'pair_1'),
      text('river', 'Nile'),
    ]);
  });

  it('does not hand a held-aside row id to a text row', () => {
    const previous: RequestBodyParameter[] = [
      withId('lake', 'Victoria', 'pair_1'),
      { name: 'photo[0]', value: '', disabled: false, type: 'file', fileName: '/tmp/bwindi.jpg', id: 'pair_file' },
      withId('river', 'Nile', 'pair_2'),
    ];
    const result = parsePairs('lake:Victoria\nriver:Nile', previous);

    expect(result.map(pair => pair.id)).toEqual(['pair_1', 'pair_file', 'pair_2']);
  });

  it('keeps ids unique when a row is deleted and the rest shift up', () => {
    const previous = [
      withId('lake', 'Victoria', 'pair_1'),
      withId('river', 'Nile', 'pair_2'),
      withId('forest', 'Mabira', 'pair_3'),
    ];
    const ids = parsePairs('river:Nile\nforest:Mabira', previous).map(pair => pair.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('known limitations', () => {
  it('cannot represent a name containing the separator', () => {
    expect(parsePairs('xml:lang:en')).toEqual([text('xml', 'lang:en')]);
  });

  it('reads an indented row as an ordinary pair, since the name is trimmed', () => {
    expect(parsePairs('   lake:Victoria')).toEqual([text('lake', 'Victoria')]);
  });
});

describe('BULK_EDIT_PLACEHOLDER', () => {
  it('documents each rule of the format on its own line', () => {
    expect(BULK_EDIT_PLACEHOLDER.split('\n')).toHaveLength(3);
    expect(BULK_EDIT_PLACEHOLDER).toContain('separated by new lines');
    expect(BULK_EDIT_PLACEHOLDER).toContain('separated by :');
    expect(BULK_EDIT_PLACEHOLDER).toContain('Prepend // ');
  });
});
