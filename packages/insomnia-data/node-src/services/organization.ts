import { models } from '../../src';
import type { Organization } from '../../src/models/organization';

/** There is a single local organization. */
export async function list(): Promise<Organization[]> {
  return [models.organization.LOCAL_ORGANIZATION];
}

/** Get a single organization by ID. */
export async function get(id: string): Promise<Organization | undefined> {
  const all = await list();
  return all.find(org => org.id === id);
}
