import type { CaCertificate } from '../models/ca-certificate';
import type { ClientCertificate } from '../models/client-certificate';
import type { Settings } from '../models/settings';
import type { RenderedRequest } from '../templating/types';

const PREF_SECURITY = 'Insomnia’s Preferences → Security';

export function isFsAccessingAllowed(
  renderedRequest: RenderedRequest,
  settings: Settings,
  clientCertificates: ClientCertificate[],
  _?: CaCertificate | null,
  fromCli?: boolean,
) {
  const throwError = (fileName: string) => {
    if (fromCli) {
      throw `Insomnia cannot access the file ‘${fileName}’. You can specify paths with one or more "--dataFolders <directory>" or "-f <directory>" to allow accessing.`;
    } else {
      throw `Insomnia cannot access the file ‘${fileName}’. You must specify which directories Insomnia can access in ${PREF_SECURITY}.`;
    }
  };

  // case1: check request body (set by scripts or request body editor)
  if (renderedRequest.body.fileName !== undefined && renderedRequest.body.fileName !== '') {
    const allowed = settings?.dataFolders.some(
      folder => folder !== '' && renderedRequest.body.fileName?.startsWith(folder),
    );
    if (!allowed) {
      throwError(renderedRequest.body.fileName);
    }
  }

  // case2: check the body form data - "file" type params
  if (Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params.forEach(param => {
      if (param.type === 'file' && !param.disabled) {
        const allowed = settings?.dataFolders.some(folder => folder !== '' && param.fileName?.startsWith(folder));
        if (!allowed) {
          throwError(param.fileName || param.value);
        }
      }
    });
  }

  // case3: check the caCert path
  // Enable this if really needed as it is uploaded by user and can't be changed by scripts
  // if (!caCert?.disabled && caCert?.path) {
  //   const allowed = settings?.dataFolders.some(folder => folder !== '' && caCert.path?.startsWith(folder));
  //   if (!allowed) {
  //     throwError(caCert.path);
  //   }
  // }

  // case4: check paths of client certificates
  if (Array.isArray(clientCertificates)) {
    clientCertificates.forEach(cert => {
      if (cert.disabled) {
        return;
      }

      [cert.key, cert.cert, cert.pfx].forEach(targetPath => {
        if (targetPath) {
          const allowed = settings?.dataFolders.some(
            folder => folder !== '' && targetPath !== '' && targetPath?.startsWith(folder),
          );
          if (!allowed) {
            throwError(targetPath);
          }
        }
      });
    });
  }

  // case5: check "file" template tags, which is checked in tag implementation
}
