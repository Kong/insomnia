import type { Response } from '~/insomnia-data';

export function migrate(doc: Response) {
  try {
    return migrateBodyCompression(doc);
  } catch (e) {
    console.log('[db] Error during response migration', e);
    throw e;
  }
}

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}
