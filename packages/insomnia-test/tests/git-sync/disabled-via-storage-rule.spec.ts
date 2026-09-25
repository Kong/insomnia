import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, setGitSyncStorageRule } from "../../misc/fixtures";
import { expect, test } from "../../misc/git-fixtures";

test.beforeAll(async () => {
  await setGitSyncStorageRule(false);
});

test.afterAll(async () => {
  await setGitSyncStorageRule(true);
});

test("Verify the create-project dialog shows a storage-restriction banner and disables the Git project type when Git Sync is disabled by org storage rule", async ({
  user,
}) => {
  const { workspacePage, projectSettingsPage } = user.pageManager;

  await workspacePage.clickNewProject();

  let bannerText: string | undefined;
  await expect
    .poll(
      async () =>
        (bannerText = await projectSettingsPage.getBannerText(
          "Project Storage Restriction Banner",
        )),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  expect(bannerText).toContain("Cloud Sync and Local Vault");
  expect(bannerText).not.toContain("Git Sync");
  await expect
    .poll(
      () =>
        projectSettingsPage.isDisabled(
          projectSettingsPage.projectTypeTile(ProjectType.Git),
        ),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);
});
