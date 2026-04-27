import { escapeRegex } from '../common/misc';
import { setDefaultProtocol } from '../utils/url/protocol';

const DEFAULT_PORT = 443;

export function urlMatchesCertHost(certificateHost: string, requestUrl: string, needCheckPort = true) {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  let requestUrlWithProtocol: URL;
  let certificateHostWithProtocol: URL;
  try {
    requestUrlWithProtocol = new URL(requestUrl);
    certificateHostWithProtocol = new URL(cHostWithProtocol);
  } catch {
    // Return false early if either URL is invalid.
    return false;
  }
  const { hostname, port } = requestUrlWithProtocol;
  const { hostname: cHostname, port: cPort } = certificateHostWithProtocol;
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
