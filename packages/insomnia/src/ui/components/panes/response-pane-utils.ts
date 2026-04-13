import { extension as mimeExtension } from 'mime-types';

import type { Compression } from '~/insomnia-data';
import { getBodyBuffer } from '~/models/helpers/response-operations';
import { showToast } from '~/ui/components/toast-notification';
import { jsonPrettify } from '~/utils/prettify/json';

export async function downloadResponseBody(
  activeRequest: { name: string } | null | undefined,
  activeResponse:
    | {
        contentType: string;
        bodyBuffer?: Buffer | null;
        bodyPath?: string;
        bodyCompression?: Compression;
      }
    | null
    | undefined,
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

  let body: Buffer;
  try {
    if (activeResponse.bodyBuffer) {
      body = activeResponse.bodyBuffer;
    } else if (activeResponse.bodyPath) {
      const raw = await getBodyBuffer(activeResponse);
      body = typeof raw === 'string' ? Buffer.from(raw) : raw;
    } else {
      console.warn('Response has no bodyBuffer or bodyPath; writing empty file');
      body = Buffer.alloc(0);
    }
  } catch (error) {
    console.error('Failed to read response body for export', error);
    showToast({
      icon: 'circle-exclamation',
      title: 'Export failed',
      description: 'Could not read the response body from disk.',
      status: 'error',
    });
    return;
  }

  if (prettify && activeResponse.bodyBuffer && contentType.includes('json')) {
    await window.main.writeFile({
      path: outputPath,
      content: jsonPrettify(body.toString('utf8')) || '',
    });
    return;
  }
  await window.main.writeFile({ path: outputPath, content: body });
}
