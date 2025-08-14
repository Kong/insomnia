import path from 'node:path';

import type { CaCertificate } from '../models/ca-certificate';
import type { ClientCertificate } from '../models/client-certificate';
import type { Settings } from '../models/settings';
import type { RenderedRequest } from '../templating/types';

const PREF_SECURITY = 'Insomnia’s Preferences → Security';

export const throwError = (fileName: string, fromCli: boolean) => {
  if (fromCli) {
    throw `Insomnia cannot access the file ‘${fileName}’. You can specify paths with one or more "--dataFolders <directory>" or "-f <directory>" to allow accessing.`;
  } else {
    throw `Insomnia cannot access the file ‘${fileName}’. You must specify which directories Insomnia can access in ${PREF_SECURITY}.`;
  }
};

export function isFsAccessingAllowed(
  renderedRequest: RenderedRequest,
  settings: Settings,
  clientCertificates: ClientCertificate[],
  _?: CaCertificate | null,
  fromCli?: boolean,
) {


  // case1: check request body (set by scripts or request body editor)
  if (renderedRequest.body.fileName !== undefined && renderedRequest.body.fileName !== '') {
    const bodyPath = path.resolve(renderedRequest.body.fileName);

    const allowed = settings?.dataFolders.some(
      folder => {
        const absFolder = path.resolve(folder);
        return absFolder !== '' && bodyPath.startsWith(absFolder);
      });

    if (!allowed) {
      throwError(renderedRequest.body.fileName, fromCli || false);
    }
  }

  // case2: check the body form data - "file" type params
  if (Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params.forEach(param => {
      if (param.type === 'file' && !param.disabled) {
        const absFilePath = path.resolve(param.fileName || '');

        const allowed = settings?.dataFolders.some(allowedfolder => {
          const absFolder = path.resolve(allowedfolder);
          return absFolder !== '' && absFilePath?.startsWith(absFolder);
        });

        if (!allowed) {
          throwError(absFilePath || param.value, fromCli || false);
        }
      }
    });
  }

  // case3: check the caCert path
  // Enable this if really needed as it is uploaded by user and can't be changed by scripts
  // if (!caCert?.disabled && caCert?.path) {
  //   const allowed = settings?.dataFolders.some(folder => folder !== '' && caCert.path?.startsWith(folder));
  //   if (!allowed) {
  //     throwError(caCert.path, fromCli || false);
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
          const absTargetPath = path.resolve(targetPath);

          const allowed = settings?.dataFolders.some(
            allowedFolder => {
              const absFolder = path.resolve(allowedFolder);
              return absFolder !== '' && absTargetPath !== '' && absTargetPath?.startsWith(absFolder);
            }
          );
          if (!allowed) {
            throwError(absTargetPath, fromCli || false);
          }
        }
      });
    });
  }

  // case5: check "file" template tags, which is checked in tag implementation
}
