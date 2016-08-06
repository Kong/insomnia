const cookies = {
  "version": "tough-cookie@2.3.1",
  "storeType": "MemoryCookieStore",
  "rejectPublicSuffixes": true,
  "cookies": [{
    "key": "XSRF-TOKEN",
    "value": "0WzNSnkq-uiiCv7qIoKs8Ilhn1vBkCYuBYTA",
    "domain": "insomnia.rest",
    "path": "/",
    "hostOnly": true,
    "pathIsDefault": true,
    "creation": "2016-08-05T20:19:47.377Z",
    "lastAccessed": "2016-08-06T00:41:29.124Z"
  }]
};

export function extractCookiesFromJar (cookieJar) {
  cookieJar._jar.store.getAllCookies((err, cookies) => {
    console.log(err, cookies);
    for (const cookie of cookies) {
      console.log('COOKIE', cookie.toString());
    }
  });
}


