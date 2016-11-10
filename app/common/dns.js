import dns from 'dns';
import {parse as urlParse, format as urlFormat} from 'url';

/**
 * Resolve to IP address and prefer IPv6 (only if supported)
 *
 * @param url
 * @param forceIPv4
 * @returns {Promise}
 */
function lookup (url, forceIPv4) {
  return new Promise((resolve, reject) => {
    const {hostname} = urlParse(url);

    const options = {
      hints: dns.ADDRCONFIG, // Only lookup supported addresses
      all: true,
    };

    if (forceIPv4) {
      options.family = 4;
    }

    dns.lookup(hostname, options, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      const v6 = results.find(r => r.family === 6);
      if (v6) {
        resolve(v6.address);
      } else if (results.length) {
        // If no v6, return the first result
        resolve(results[0].address);
      } else {
        // The only case I can find that hits this is sending in an IPv6
        // address like `::1`
        reject(new Error('Could not resolve host'))
      }
    });
  })
}

export async function swapHost (url, forceIPv4) {
  try {
    const ip = await lookup(url, forceIPv4);
    const parsedUrl = urlParse(url);
    delete parsedUrl.host; // So it doesn't build with old host
    parsedUrl.hostname = ip;
    return urlFormat(parsedUrl);
  } catch (e) {
    // Fail silently. It's OK
    return url;
  }
}
