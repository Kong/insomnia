import type { RequestRepository } from 'insomnia-domain';

import { deleteRequest } from './delete-request.use-case';
import { updateRequest, type UpdateRequestPatch } from './update-request.use-case';

export class RequestModule {
  constructor(private readonly requestRepository: RequestRepository) {}

  updateById(id: string, patch: UpdateRequestPatch) {
    return updateRequest(this.requestRepository, id, patch);
  }

  deleteById(id: string) {
    return deleteRequest(this.requestRepository, id);
  }
}
