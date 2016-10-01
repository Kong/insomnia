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
  const ip = await lookup(url);
  const parsedUrl = urlParse(url);

  // So it won't build to the old one value still
  delete parsedUrl.host;

  parsedUrl.hostname = ip;

  return urlFormat(parsedUrl);
}
