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

/**
 * Grandfather in cookies that predate the `source` field as 'manual', so cookies a user
 * already relied on for template rendering keep working; every write path introduced alongside
 * `source` (network responses, imports, scripts) always sets it explicitly, so once a cookie
 * has passed through this migration once, `source` should never go missing again. Known,
 * accepted tradeoff: a pre-existing response-planted cookie is indistinguishable from a manual
 * one at this point and gets grandfathered in as trusted too, since there's no way to tell them
 * apart without breaking rendering for every user's pre-existing manual cookies.
 */
function migrateCookieSource(cookieJar: CookieJar) {
  for (const cookie of cookieJar.cookies) {
    if (!cookie.source) {
      cookie.source = 'manual';
    }
  }

  return cookieJar;
}

export function migrate(doc: CookieJar) {
  try {
    doc = migrateCookieId(doc);
    doc = migrateCookieSource(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during cookie jar migration', e);
    throw e;
  }
}
