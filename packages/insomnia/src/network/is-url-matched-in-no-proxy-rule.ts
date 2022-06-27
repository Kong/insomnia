import { parse as urlParse } from 'url';

function formatHostname(rawHostname: string) {
  // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
  const hostname = rawHostname.replace(/^\.*/, '.').toLowerCase();
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function parseNoProxyZone(zone: string) {
  zone = zone.trim().toLowerCase();
  const zoneParts = zone.split(':', 2);
  const zoneHost = formatHostname(zoneParts[0]);
  const zonePort = zoneParts[1];
  const hasPort = zone.indexOf(':') > -1;

  return { hostname: zoneHost, port: zonePort, hasPort: hasPort };
}

function matchesHostname(hostname: string, noProxyZoneHostname: string) {
  const wildcardNeedle = noProxyZoneHostname.startsWith('.*.') ? noProxyZoneHostname.slice(2) : noProxyZoneHostname;
  const isMatchedAt = hostname.indexOf(wildcardNeedle);
  return (isMatchedAt > -1 && (isMatchedAt === hostname.length - wildcardNeedle.length));
}

export function isUrlMatchedInNoProxyRule(url: string | undefined, noProxyRule: any) {
  if (!url || !noProxyRule || typeof noProxyRule !== 'string') {
    return false;
  }
  const uri = urlParse(url);
  if (!uri.hostname && !uri.port && !uri.protocol) {
    return false;
  }
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80');
  // TODO: remove non-null assertion
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const hostname = formatHostname(uri.hostname!);
  const noProxyList = noProxyRule.split(',');

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some(noProxyZone => {
    if (!noProxyZone.hostname && noProxyZone.hasPort) {
      return port === noProxyZone.port;
    }
    const hostnameMatched = matchesHostname(hostname, noProxyZone.hostname);
    if (noProxyZone.hasPort) {
      return (port === noProxyZone.port) && hostnameMatched;
    }
    return hostnameMatched;
  });
}
