import { faker } from "@faker-js/faker";

import { ContentType } from "../../enums/content-type";
import { DEFAULT_TIMEOUT, expect, test } from "../../misc/fixtures";

for (const { version, chosenIndex } of [
  { version: "Current", chosenIndex: 0 },
  { version: "Incoming", chosenIndex: 1 },
] as const) {
  test(`Verify resolving a merge conflict by choosing the ${version} version keeps that side's request body on a Cloud-synced workspace`, async ({
    user,
  }) => {
    const { workspaceFlow, httpRequestFlow, cloudSyncFlow } = user.flowManager;
    const { httpRequestPage, cloudSyncPage } = user.pageManager;

    await cloudSyncFlow.fetch("My Collection R1");
    const collection = await workspaceFlow.getCollection({
      name: "My Collection R1",
    });
    await httpRequestFlow.get("New Request", collection);

    const branch = faker.git.branch();
    const branchBody = faker.lorem.slug();
    await cloudSyncFlow.createBranch(branch);
    await httpRequestPage.setBody({
      mimeType: ContentType.Plain,
      text: branchBody,
    });
    await cloudSyncFlow.commit("New Request", faker.lorem.sentence());

    await cloudSyncPage.openBranchesDialog();
    await cloudSyncPage.checkoutLocalBranch("master");
    await cloudSyncPage.closeBranchesDialog();
    await user.page.reload();
    await httpRequestFlow.get("New Request", collection);
    const currentBody = faker.lorem.slug();
    await httpRequestPage.setBody({
      mimeType: ContentType.Plain,
      text: currentBody,
    });
    await cloudSyncFlow.commit("New Request", faker.lorem.sentence());

    const conflicts = await cloudSyncFlow.mergeBranchResolvingConflicts(
      branch,
      version,
    );
    await user.page.reload();
    await httpRequestFlow.get("New Request", collection);
    const bodies = [currentBody, branchBody];

    expect(conflicts).toEqual(["New Request"]);
    await expect
      .poll(() => httpRequestPage.getBody(), { timeout: DEFAULT_TIMEOUT })
      .toEqual({ mimeType: ContentType.Plain, text: bodies[chosenIndex] });
  });
}
