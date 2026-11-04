import { models } from 'insomnia-data';
import { href, redirect } from 'react-router';

export async function clientLoader() {
  return redirect(href('/organization/:organizationId', { organizationId: models.organization.LOCAL_ORGANIZATION_ID }));
}
