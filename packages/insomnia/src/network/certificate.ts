import type { ClientCertificate } from '../models/client-certificate';
import { setDefaultProtocol } from '../utils/url/protocol';
import { urlMatchesCertHost } from './url-matches-cert-host';

export function filterClientCertificates(clientCertificates: ClientCertificate[], requestUrl: string, protocol?: string) {
  const res = clientCertificates.filter(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, protocol), requestUrl, true));
  // If didn't get a matching certificate at the first time, ignore the port check and try again
  if (!res.length) {
    return clientCertificates.filter(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, protocol), requestUrl, false));
  }
  return res;
}
