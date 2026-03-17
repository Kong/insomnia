import { models, type Services } from '~/insomnia-data';

import { createBaseOperations } from './base';

export const caCertificateService: Services['caCertificate'] = {
  ...createBaseOperations(models.caCertificate.type),
};
