import type { RequestRepository } from 'insomnia-domain';

export async function deleteRequest(requestRepository: RequestRepository, requestId: string): Promise<void> {
  const request = await requestRepository.findById(requestId);
  if (!request) {
    throw new Error(`Request not found: ${requestId}`);
  }
  await requestRepository.delete(requestId);
}
