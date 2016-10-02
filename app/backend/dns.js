import dns from 'dns';
import {parse as urlParse, format as urlFormat} from 'url';

function lookup (url) {
  return new Promise((resolve, reject) => {
    const {hostname} = urlParse(url);
    dns.lookup(hostname, (err, ip) => {
      err ? reject(err) : resolve(ip)
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
