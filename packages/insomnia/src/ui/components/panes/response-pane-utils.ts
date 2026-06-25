import { extension as mimeExtension } from 'mime-types';

import { bodyBufferToUtf8 } from '~/common/utils/utf8-bytes';
import { jsonPrettify } from '~/ui/utils/prettify/json';

export async function downloadResponseBody(
  activeRequest: { name: string } | null | undefined,
  activeResponse:
    | {
        contentType: string;
        bodyBuffer?: Uint8Array | null;
        bodyPath?: string;
        bodyCompression?: 'zip' | null | '__NEEDS_MIGRATION__';
      }
    | null
    | undefined,
  prettify: boolean,
  getBodyBuffer?: () => Promise<Uint8Array | null>,
) {
  if (!activeResponse || !activeRequest) {
    console.warn('Nothing to download');
    return;
  }

  const { contentType } = activeResponse;
  const extension = mimeExtension(contentType) || 'unknown';
  const { canceled, filePath: outputPath } = await window.dialog.showSaveDialog({
    title: 'Save Response Body',
    buttonLabel: 'Save',
    defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`,
  });

  if (canceled) {
    return;
  }
  let bodyBuffer = activeResponse.bodyBuffer ?? null;

  if (!bodyBuffer && !prettify && activeResponse.bodyPath) {
    await window.main.writeResponseBodyToFile({
      sourcePath: activeResponse.bodyPath,
      destinationPath: outputPath,
      bodyCompression: activeResponse.bodyCompression === 'zip' ? 'zip' : null,
    });
    return;
  }

  if (!bodyBuffer && getBodyBuffer) {
    const diskBodyBuffer = await getBodyBuffer();
    if (diskBodyBuffer) {
      bodyBuffer = diskBodyBuffer;
    }
  }

  if (prettify && contentType.includes('json')) {
    await window.main.writeFile({
      path: outputPath,
      content: jsonPrettify(bodyBufferToUtf8(bodyBuffer)) || '',
    });
    return;
  }
  await window.main.writeFile({ path: outputPath, content: bodyBuffer ?? new Uint8Array(0) });
}
