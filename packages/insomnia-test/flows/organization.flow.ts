import type { CollaboratorRole } from "../enums/collaborator-role";
import { BaseFlow } from "./base.flow";

/**
 * One entry to pass to `OrganizationFlow.invite()`: either a brand-new
 * invitee added by typed email, an existing organization member added by
 * searching for and selecting their `email` (identified by carrying
 * `existed: true`), or a role change for a collaborator who's already a
 * member (identified by carrying a `role`).
 */
export interface Collaborator {
  email: string;
  role?: CollaboratorRole;
  existed?: boolean;
}

export class OrganizationFlow extends BaseFlow {
  /**
   * Adds every `collaborators` entry as a pending invitee to the currently
   * open "Invite collaborators" dialog — by typed email, or (when carrying
   * `existed: true`) by searching organization members and selecting the
   * one matching `email` — then submits them all via "Invite". An entry
   * carrying a `role` without `existed` is already listed as a collaborator
   * (not a new invitee), so it's skipped here entirely.
   *
   * Afterward, every entry carrying a `role` — freshly added or already
   * listed — has its current role read back and is only changed if it
   * doesn't already match, rather than always clicking through the role
   * menu.
   * @param collaborators - The invitees to add and/or collaborators whose role to check/change
   */
  async invite(...collaborators: Collaborator[]): Promise<void> {
    const { invitePage } = this.pageManager;
    const alreadyListed = (c: Collaborator) =>
      c.role !== undefined && !c.existed;
    const invitees = collaborators.filter((c) => !alreadyListed(c));

    for (const invitee of invitees) {
      if (invitee.existed) {
        await invitePage.searchOrganizationMembers(invitee.email);
        await invitePage.selectOrganizationMember(invitee.email);
      } else {
        await invitePage.addEmail(invitee.email);
      }
    }
    if (invitees.length) await invitePage.sendInvites();

    for (const { email, role } of collaborators) {
      if (role === undefined) continue;
      const currentRole = await invitePage.getMemberRole(email);
      if (currentRole !== role) await invitePage.setMemberRole(email, role);
    }
  }
}
