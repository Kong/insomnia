import dns from 'dns';
import {parse as urlParse, format as urlFormat} from 'url';

/**
 * Try to find a supported IPv6 address. Will throw if none found.
 *
 * @param url
 * @returns {Promise}
 */
function lookupIPv6 (url) {
  return new Promise((resolve, reject) => {
    const {hostname} = urlParse(url);

    const options = {
      hints: dns.ADDRCONFIG,
      family: 6,
    };

    dns.lookup(hostname, options, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  })
}

export async function swapHost (url) {
  let ip;

  try {
    ip = await lookupIPv6(url);
    const parsedUrl = urlParse(url);
    delete parsedUrl.host; // So it doesn't build with old host
    parsedUrl.hostname = ip;
    return urlFormat(parsedUrl);
  } catch (e) {
    // Fail silently. It's OK
    return url;
  }
}
