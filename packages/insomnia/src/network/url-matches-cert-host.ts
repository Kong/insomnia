import { escapeRegex } from '../common/misc';
import { setDefaultProtocol } from '../utils/url/protocol';

const DEFAULT_PORT = 443;

export function urlMatchesCertHost(certificateHost: string, requestUrl: string, needCheckPort = true) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');

  let hostname = '';
  let port = '';
  try {
    const parsedUrl = new URL(requestUrl);
    hostname = parsedUrl.hostname;
    port = parsedUrl.port;
  } catch {
    // If URL parsing fails, return false
    return false;
  }
  let certificateHostWithProtocol = new URL('https://example.com');
  try {
    certificateHostWithProtocol = new URL(cHostWithProtocol);
  } catch {
    // return false early if the certificate host is invalid
    return false;
  }
  let { hostname: cHostname, port: cPort } = certificateHostWithProtocol;
  // This function is used in both main and renderer processes. In the renderer process,
  // URL API encodes * in the hostname and port (e.g. *.example.com becomes %2A.example.com).
  // Here we decode them back to * to make it consistent.
  cHostname = decodeURIComponent(cHostname);
  cPort = decodeURIComponent(cPort);

  const assumedPort = Number.parseInt(port) || DEFAULT_PORT;
  const assumedCPort = Number.parseInt(cPort) || DEFAULT_PORT;
  const cHostnameRegex = escapeRegex(cHostname || '').replace(/\\\*/g, '.*');
  const cPortRegex = escapeRegex(cPort || '').replace(/\\\*/g, '.*');

  // Check ports
  if (needCheckPort) {
    if ((cPort + '').includes('*')) {
      if (!(port || '').match(`^${cPortRegex}$`)) {
        return false;
      }
    } else {
      if (assumedCPort !== assumedPort) {
        return false;
      }
    }
  }

  // Check hostnames
  if (!(hostname || '').match(`^${cHostnameRegex}$`)) {
    return false;
  }

  // Everything matches
  return true;
}
