import {
  type AnyRequest,
  getPathParametersFromUrl,
  getRequestBodyForMimeTypeChange,
  isRequest,
  isWebSocketRequest,
  type RequestRepository,
} from 'insomnia-domain';

export type UpdateRequestPatch = Record<string, any>;

export async function updateRequest(
  requestRepository: RequestRepository,
  requestId: string,
  patch: UpdateRequestPatch,
): Promise<AnyRequest> {
  const request = await requestRepository.findById(requestId);
  if (!request) {
    throw new Error(`Request not found: ${requestId}`);
  }

  let effectivePatch = patch;

  const isUrlChanged = (isRequest(request) || isWebSocketRequest(request)) && patch.url && patch.url !== request.url;
  if (isUrlChanged) {
    const pathParameters = getPathParametersFromUrl(patch.url).map(name => ({
      name,
      value: request.pathParameters?.find(p => p.name === name)?.value || '',
    }));
    effectivePatch = { ...effectivePatch, pathParameters };
  }

  const isMimeTypeChanged = isRequest(request) && patch.body && patch.body.mimeType !== request.body.mimeType;
  if (isMimeTypeChanged) {
    effectivePatch = { ...effectivePatch, ...getRequestBodyForMimeTypeChange(request, patch.body?.mimeType) };
  }

  const updated = { ...request, ...effectivePatch, modified: Date.now() } as AnyRequest;
  await requestRepository.save(updated);
  return updated;
}
