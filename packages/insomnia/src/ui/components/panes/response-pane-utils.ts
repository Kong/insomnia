import { extension as mimeExtension } from 'mime-types';

import { jsonPrettify } from '~/utils/prettify/json';

export async function downloadResponseBody(
  activeRequest: { name: string } | null | undefined,
  activeResponse: { contentType: string; bodyBuffer?: Buffer | null } | null | undefined,
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
      content: jsonPrettify(activeResponse.bodyBuffer?.toString('utf8')) || '',
    });
    return;
  }
  await window.main.writeFile({ path: outputPath, content: activeResponse.bodyBuffer ?? Buffer.alloc(0) });
}
