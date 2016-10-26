import dns from 'dns';
import {parse as urlParse, format as urlFormat} from 'url';

/**
 * Resolve to IP address and prefer IPv6 (only if supported)
 *
 * @param url
 * @returns {Promise}
 */
function lookup (url) {
  return new Promise((resolve, reject) => {
    const {hostname} = urlParse(url);

    const options = {
      hints: dns.ADDRCONFIG, // Only lookup supported addresses
      all: true,
    };

    dns.lookup(hostname, options, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      const v6 = results.find(r => r.family === 6);
      const v4 = results.find(r => r.family === 4);

      if (v6) {
        resolve(v6.address);
      } else {
        resolve(v4.address);
      }
    });
  })
}

export async function swapHost (url) {
  let ip;

  try {
    ip = await lookup(url);
    const parsedUrl = urlParse(url);
    delete parsedUrl.host; // So it doesn't build with old host
    parsedUrl.hostname = ip;
    return urlFormat(parsedUrl);
  } catch (e) {
    // Fail silently. It's OK
    return url;
  }
}
