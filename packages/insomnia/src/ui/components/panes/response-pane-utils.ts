import { extension as mimeExtension } from 'mime-types';

import { bodyBufferToUtf8 } from '~/common/utils/utf8-bytes';
import { jsonPrettify } from '~/ui/utils/prettify/json';

export async function downloadResponseBody(
  activeRequest: { name: string } | null | undefined,
  activeResponse: { contentType: string; bodyBuffer?: Uint8Array | null } | null | undefined,
  prettify: boolean,
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
  if (prettify && contentType.includes('json')) {
    await window.main.writeFile({
      path: outputPath,
      content: jsonPrettify(bodyBufferToUtf8(activeResponse.bodyBuffer)) || '',
    });
    return;
  }
  await window.main.writeFile({ path: outputPath, content: activeResponse.bodyBuffer ?? new Uint8Array(0) });
}
