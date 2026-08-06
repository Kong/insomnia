import type { RequestRepository } from 'insomnia-domain';

import { deleteRequest } from './delete-request.use-case';

export class RequestModule {
  constructor(private readonly requestRepository: RequestRepository) {}

  deleteById(id: string) {
    return deleteRequest(this.requestRepository, id);
  }
}
