import { CurlRequestOptions, CurlRequestOutput } from '../main/network/libcurl-promise';
const cancelRequestFunctionMap = new Map<string, () => void>();
export async function cancelRequestById(requestId: string) {
  const cancel = cancelRequestFunctionMap.get(requestId);
  if (cancel) {
    return cancel();
  }
  console.log(`[network] Failed to cancel req=${requestId} because cancel function not found`);
}
export const cancellableCurlRequest = (requestOptions: CurlRequestOptions) => {
  const requestId = requestOptions.requestId;
  return new Promise<CurlRequestOutput | { statusMessage: string; error: string }>(async resolve => {
    try {
      cancelRequestFunctionMap.set(requestId, async () => {
        cancelRequestFunctionMap.delete(requestId);
        window.main.cancelCurlRequest(requestId);
        return resolve({ statusMessage: 'Cancelled', error: 'Request was cancelled' });
      });

      // NOTE: conditionally use ipc bridge, renderer cannot import native modules directly
      const nodejsCurlRequest = process.type === 'renderer'
        ? window.main.curlRequest
        : (await import('../main/network/libcurl-promise')).curlRequest;
      return resolve(nodejsCurlRequest(requestOptions));

    } catch (err) {
      console.log('[network] Error', err);
      cancelRequestFunctionMap.delete(requestId);
      return resolve({ statusMessage: 'Error', error: err.message || 'Something went wrong' });
    }
  });
};
