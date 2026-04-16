import { type ActionFunctionArgs, href } from 'react-router';

import type { ScanResult } from '~/common/import';
import { IMPORT_SOURCE_TYPES } from '~/common/import-source';
import type { ImportScanInputData } from '~/main/import';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

export const scanImportResources = async (data: ImportScanInputData): Promise<ScanResult[]> => {
  const { source } = data;
  invariant(typeof source === 'string', 'Source is required.');
  invariant(IMPORT_SOURCE_TYPES.includes(source), 'Unsupported import type');

  window.main.trackSegmentEvent({
    event: SegmentEvent.importScanned,
    properties: {
      source,
    },
  });

  return window.main.scanImportResources({
    ...data,
    clipboardText: source === 'clipboard' ? window.clipboard.readText() : undefined,
  });
};

export async function clientAction({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries()) as unknown as ImportScanInputData;

    return await scanImportResources(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return [
      {
        errors: [errorMessage],
      },
    ];
  }
}

export const useScanResourcesFetcher = createFetcherSubmitHook(
  submit => (data: FormData | HTMLFormElement) => {
    return submit(data, {
      action: href('/import/scan'),
      method: 'POST',
    });
  },
  clientAction,
);
