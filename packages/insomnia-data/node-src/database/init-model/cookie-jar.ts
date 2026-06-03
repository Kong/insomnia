import type { CookieJar } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

/** Ensure every cookie has an ID property */
function migrateCookieId(cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.id) {
      cookie.id = uuidv4();
    }
  }

  return cookieJar;
}

export function migrate(doc: CookieJar) {
  try {
    doc = migrateCookieId(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during cookie jar migration', e);
    throw e;
  }
}
