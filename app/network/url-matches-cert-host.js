import {parse as urlParse} from 'url';
import certificateUrlParse from './certificate-url-parse';
import {setDefaultProtocol} from '../common/misc';

const defaultPort = 443;

const urlMatchesCertHost = (certificateHost, requestUrl) => {
  const cHostWithProtocol = setDefaultProtocol(certificateHost, 'https:');
  const {hostname, port} = urlParse(requestUrl);
  const {hostname: cHostname, port: cPort} = certificateUrlParse(cHostWithProtocol);

  const assumedPort = parseInt(port) || defaultPort;
  const assumedCPort = parseInt(cPort) || defaultPort;

  const cHostnameRegex = (cHostname || '').replace(/([.+?^=!:${}()|[\]/\\])/g, '\\$1')
                                          .replace(/\*/g, '.*');

  return (assumedCPort === assumedPort && !!hostname.match(`^${cHostnameRegex}$`));
};

export default urlMatchesCertHost;
