import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, setGitSyncFeatureFlag } from "../../misc/fixtures";
import { expect, test } from "../../misc/git-fixtures";

test.beforeAll(async () => {
  await setGitSyncFeatureFlag(false);
});

test.afterAll(async () => {
  await setGitSyncFeatureFlag(true);
});

test("Verify selecting the Git project type shows the disabled-feature banner, hides the setup form, and disables Scan for files when Git Sync is disabled by org feature flag", async ({
  user,
}) => {
  const { workspacePage, projectSettingsPage } = user.pageManager;

  await workspacePage.clickNewProject();
  await workspacePage.clickProjectTypeTile(ProjectType.Git);

  let bannerText: string | undefined;
  await expect
    .poll(
      async () =>
        (bannerText = await projectSettingsPage.getBannerText(
          "Git Sync Feature Disabled Banner",
        )),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBeTruthy();
  expect(bannerText).toContain("Git Sync limited to organizations");
  await expect
    .poll(() => projectSettingsPage.isHidden(projectSettingsPage.gitSetupForm), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  await expect
    .poll(
      () =>
        projectSettingsPage.isDisabled(projectSettingsPage.scanForFilesButton),
      { timeout: DEFAULT_TIMEOUT },
    )
    .toBe(true);
});
