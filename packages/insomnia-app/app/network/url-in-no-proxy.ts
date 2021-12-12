import { parse as urlParse } from 'url';

function formatHostname(hostname) {
  // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
  return hostname.replace(/^\.*/, '.').toLowerCase();
}

function parseNoProxyZone(zone) {
  zone = zone.trim().toLowerCase();
  const zoneParts = zone.split(':', 2);
  const zoneHost = formatHostname(zoneParts[0]);
  const zonePort = zoneParts[1];
  const hasPort = zone.indexOf(':') > -1;

  return { hostname: zoneHost, port: zonePort, hasPort: hasPort };
}

export function urlInNoProxy(url: string | undefined, noProxy: any) {
  if (!url || !noProxy || typeof noProxy !== 'string') {
    return false;
  }
  const uri = urlParse(url);

  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80');
  const hostname = formatHostname(uri.hostname);
  const noProxyList = noProxy.split(',');

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some(noProxyZone => {
    const isMatchedAt = hostname.indexOf(noProxyZone.hostname);
    const hostnameMatched = (isMatchedAt > -1 && (isMatchedAt === hostname.length - noProxyZone.hostname.length));

    if (noProxyZone.hasPort) {
      return (port === noProxyZone.port) && hostnameMatched;
    }

    return hostnameMatched;
  });
}
