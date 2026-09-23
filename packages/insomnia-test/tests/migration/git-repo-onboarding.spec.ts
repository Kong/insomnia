import * as fs from "node:fs";
import path from "node:path";

import { expect, test } from "../../misc/fixtures";

const testWithPendingGitMigration = test.extend({
  dataPath: async ({ dataPath }, use) => {
    const now = Date.now();
    const gitRepositoryId = "git_pendingmigration";

    const project = {
      _id: "proj_pendingmigration",
      type: "Project",
      parentId: null,
      modified: now,
      created: now,
      name: "Git Migration Test Project",
      remoteId: null,
      gitRepositoryId,
    };

    const gitRepository = {
      _id: gitRepositoryId,
      type: "GitRepository",
      parentId: null,
      modified: now,
      created: now,
      needsFullClone: false,
      uri: "https://github.com/example/insomnia-git-example.git",
      credentials: null,
      author: { name: "", email: "" },
      uriNeedsMigration: false,
    };

    await fs.promises.mkdir(dataPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(dataPath, "insomnia.Project.db"),
      JSON.stringify(project) + "\n",
      "utf8",
    );
    await fs.promises.writeFile(
      path.join(dataPath, "insomnia.GitRepository.db"),
      JSON.stringify(gitRepository) + "\n",
      "utf8",
    );
    await use(dataPath);
  },

  skipOnboarding: async ({}, use) => {
    await use(false);
  },
});

testWithPendingGitMigration(
  "Verify a pending Git filesystem migration is shown before the v13 onboarding, which appears immediately once it completes",
  async ({ window }) => {
    await expect(
      window.getByRole("heading", { name: "What's new in v12.6.0" }),
    ).toBeVisible();
    await expect(
      window.getByRole("heading", { name: /Welcome to Insomnia 13/ }),
    ).toBeHidden();

    await window.getByRole("button", { name: "Continue" }).click();
    await expect(
      window.getByRole("heading", { name: "Required file system update" }),
    ).toBeVisible();

    await window.getByRole("button", { name: "Update Now" }).click();
    await expect(
      window.getByRole("heading", { name: "Update Successful" }),
    ).toBeVisible({ timeout: 30_000 });

    await window.getByRole("link", { name: "Open Insomnia" }).click();
    await expect(
      window.getByRole("heading", { name: /Welcome to Insomnia 13/ }),
    ).toBeVisible();
  },
);
